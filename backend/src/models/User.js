const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true },
    password: { type: String, required: true, select: false },

    // KYC & Verification
    kycVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    phoneVerifiedAt: { type: Date },
    phoneOtpHash: { type: String },
    phoneOtpExpiresAt: { type: Date },
    phoneOtpAttempts: { type: Number, default: 0 },
    kycScore: { type: Number, default: 0, min: 0, max: 100 }, // 0-100
    governmentIdType: { type: String, enum: ["aadhaar", "pan", "driving_license"] },
    governmentIdNumber: { type: String },
    platformVerified: { type: Boolean, default: false },
    deliveryPlatform: {
      type: String,
      enum: ["zepto", "blinkit", "swiggy", "zomato", "dunzo", "other"],
    },
    platformWorkerId: { type: String },

    // Work & Income
    avgHourlyIncome: { type: Number, default: 100 }, // ₹ per hour
    weeklyAvgIncome: { type: Number, default: 5000 },
    lastActiveAt: { type: Date },

    // Location
    location: {
      lat: { type: Number },
      lng: { type: Number },
      zone: { type: String }, // e.g. "Mumbai-Andheri-West"
      city: { type: String, default: "Mumbai" },
    },

    // Bank account for payouts
    bankAccount: {
      accountNumber: { type: String },
      ifsc: { type: String },
      accountHolderName: { type: String },
      verified: { type: Boolean, default: false },
    },

    // Device info for fraud detection
    deviceInfo: {
      deviceId: { type: String },
      ipAddress: { type: String },
      carrier: { type: String },
    },

    // Account metadata
    accountAge: { type: Number, default: 0 }, // days since joining
    fraudScore: { type: Number, default: 0, min: 0, max: 100 },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Compute KYC score dynamically
userSchema.methods.computeKYCScore = function () {
  let score = 0;
  if (this.phoneVerified) score += 20;
  if (this.governmentIdNumber) score += 30;
  if (this.platformVerified) score += 40;
  if (this.accountAge >= 30) score += 20;
  if (this.bankAccount?.verified) score += 10;
  this.kycScore = Math.min(100, score);
  return score;
};

userSchema.methods.issuePhoneOtp = function () {
  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  this.phoneOtpHash = crypto.createHash("sha256").update(otp).digest("hex");
  this.phoneOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  this.phoneOtpAttempts = 0;
  return otp;
};

userSchema.methods.verifyPhoneOtp = function (otp) {
  if (!otp || !this.phoneOtpHash || !this.phoneOtpExpiresAt) return false;
  if (new Date(this.phoneOtpExpiresAt).getTime() < Date.now()) return false;
  if ((this.phoneOtpAttempts || 0) >= 5) return false;

  const incomingHash = crypto.createHash("sha256").update(String(otp)).digest("hex");
  const isValid = crypto.timingSafeEqual(
    Buffer.from(incomingHash, "hex"),
    Buffer.from(this.phoneOtpHash, "hex")
  );
  this.phoneOtpAttempts = (this.phoneOtpAttempts || 0) + 1;

  if (isValid) {
    this.phoneVerified = true;
    this.phoneVerifiedAt = new Date();
    this.phoneOtpHash = undefined;
    this.phoneOtpExpiresAt = undefined;
    this.phoneOtpAttempts = 0;
  }

  return isValid;
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
