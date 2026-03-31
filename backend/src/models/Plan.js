const mongoose = require("mongoose");

// These are the static plan tiers — seeded once into DB
const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ["lite", "smart", "pro", "flex"],
    },
    displayName: { type: String, required: true },
    weeklyPremium: { type: Number, required: true },       // ₹ per week
    coveragePerHour: { type: Number, required: true },     // ₹ per disruption hour
    maxPayoutPerEvent: { type: Number, required: true },   // ₹ cap per event
    maxPayoutPerWeek: { type: Number, required: true },    // ₹ cap per week
    maxHoursPerEvent: { type: Number, default: 6 },
    triggerTypes: {
      type: [String],
      default: ["rain", "aqi", "flood", "curfew"],
    },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", planSchema);
