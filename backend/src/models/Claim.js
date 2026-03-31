const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: "Policy", required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },

    // Payout calculation
    eligibleHours: { type: Number, required: true },
    coveragePerHour: { type: Number, required: true },
    grossPayout: { type: Number, required: true },      // before cap
    payoutAmount: { type: Number, required: true },     // after cap applied

    // Fraud detection
    fraudScore: { type: Number, default: 0, min: 0, max: 100 },
    fraudFlags: [{ type: String }],                    // list of triggered flags
    fraudDetails: { type: mongoose.Schema.Types.Mixed },

    // Claim lifecycle
    status: {
      type: String,
      enum: ["pending", "approved", "manual_review", "rejected", "paid"],
      default: "pending",
    },
    rejectionReason: { type: String },
    reviewNote: { type: String },
    processedAt: { type: Date },
    paidAt: { type: Date },

    // Razorpay payout
    razorpayPayoutId: { type: String },
    razorpayPayoutStatus: { type: String },
    razorpayFundAccountId: { type: String },

    // Worker GPS snapshot at claim time (for fraud)
    gpsSnapshot: {
      lat: { type: Number },
      lng: { type: Number },
      speed: { type: Number },     // km/h
      accuracy: { type: Number },  // meters
      timestamp: { type: Date },
    },

    // Is this an auto-triggered claim (cron) or manual test?
    triggerSource: {
      type: String,
      enum: ["auto", "manual"],
      default: "auto",
    },
  },
  { timestamps: true }
);

// Computed field: was this claim auto-approved?
claimSchema.virtual("autoApproved").get(function () {
  return this.fraudScore <= 20 && this.status === "paid";
});

module.exports = mongoose.model("Claim", claimSchema);
