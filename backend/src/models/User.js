const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true },
    password: { type: String, required: true, select: false },

    // KYC & Verification
    kycVerified: { type: Boolean, default: false },
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
  if (this.governmentIdNumber) score += 30;
  if (this.platformVerified) score += 40;
  if (this.accountAge >= 30) score += 20;
  if (this.bankAccount?.verified) score += 10;
  this.kycScore = score;
  return score;
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
