const mongoose = require("mongoose");

const policySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    planName: { type: String, required: true },

    // Financials (copied at subscription time — plan may change later)
    weeklyPremium: { type: Number, required: true },
    coveragePerHour: { type: Number, required: true },
    maxPayoutPerEvent: { type: Number, required: true },
    maxPayoutPerWeek: { type: Number, required: true },

    // Dynamic premium (may differ from base plan premium)
    dynamicPremium: { type: Number },
    premiumDiscount: { type: Number, default: 0 },   // ₹ discount applied
    premiumDiscountReason: { type: String },

    // Risk profile at time of subscription
    riskScore: { type: Number, default: 0.5, min: 0, max: 1 },
    zoneRiskFactor: { type: Number, default: 1.0 },

    // Duration
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true }, // start + 7 days
    renewalCount: { type: Number, default: 0 },

    // Status
    isActive: { type: Boolean, default: true },
    cancelledAt: { type: Date },
    cancelReason: { type: String },

    // Payment tracking
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    premiumPaid: { type: Boolean, default: false },

    // Payout tracking for this policy period
    totalPayoutThisPeriod: { type: Number, default: 0 },
    claimsThisPeriod: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-set endDate to 7 days after startDate
policySchema.pre("save", function (next) {
  if (this.isNew && !this.endDate) {
    this.endDate = new Date(this.startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Check if policy is currently valid
policySchema.methods.isValid = function () {
  const now = new Date();
  return this.isActive && this.premiumPaid && now >= this.startDate && now <= this.endDate;
};

module.exports = mongoose.model("Policy", policySchema);
