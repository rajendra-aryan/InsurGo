const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["rain", "flood", "aqi", "curfew"],
    },
    severity: {
      type: String,
      enum: ["low", "moderate", "high", "extreme"],
      default: "moderate",
    },

    // Raw API data
    rawData: {
      rainfallMm: { type: Number },      // for rain/flood
      aqiValue: { type: Number },        // for aqi
      aqiPollutant: { type: String },    // dominant pollutant
      weatherDescription: { type: String },
    },

    // Location
    city: { type: String, default: "Mumbai" },
    zones: [{ type: String }],           // affected zones/areas
    lat: { type: Number },
    lng: { type: Number },

    // Duration
    detectedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    durationHours: { type: Number },     // computed on resolve
    isActive: { type: Boolean, default: true },

    // Trigger details
    triggerValue: { type: Number },      // e.g., 65 (mm) or 320 (AQI)
    triggerThreshold: { type: Number },  // e.g., 60 or 300
    source: { type: String },            // "openweather" | "waqi" | "manual"

    // Processing
    claimsProcessed: { type: Number, default: 0 },
    totalPayoutProcessed: { type: Number, default: 0 },
    isProcessed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compute severity from trigger value vs threshold
eventSchema.methods.computeSeverity = function () {
  const ratio = this.triggerValue / this.triggerThreshold;
  if (ratio < 1.2) return "moderate";
  if (ratio < 1.5) return "high";
  return "extreme";
};

module.exports = mongoose.model("Event", eventSchema);
