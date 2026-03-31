/**
 * Seed script — run once: `npm run seed`
 * Populates the Plan collection with the 4 insurance tiers.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Plan = require("../models/Plan");
const connectDB = require("../config/db");

const PLANS = [
  {
    name: "lite",
    displayName: "Lite Shield",
    weeklyPremium: 29,
    coveragePerHour: 57,
    maxPayoutPerEvent: 200,
    maxPayoutPerWeek: 400,
    maxHoursPerEvent: 4,
    description: "Best for part-time riders. 2 disruptions/week. Rain & AQI coverage.",
    triggerTypes: ["rain", "aqi"],
  },
  {
    name: "smart",
    displayName: "Smart Shield",
    weeklyPremium: 49,
    coveragePerHour: 75,
    maxPayoutPerEvent: 300,
    maxPayoutPerWeek: 1200,
    maxHoursPerEvent: 4,
    description: "Best value for regular riders. 4 disruptions/week. All disruption types.",
    triggerTypes: ["rain", "aqi", "flood", "curfew"],
  },
  {
    name: "pro",
    displayName: "Pro Shield",
    weeklyPremium: 99,
    coveragePerHour: 100,
    maxPayoutPerEvent: 400,
    maxPayoutPerWeek: 2400,
    maxHoursPerEvent: 6,
    description: "Full-time earners. 1 payout per day. Priority processing.",
    triggerTypes: ["rain", "aqi", "flood", "curfew"],
  },
  {
    name: "flex",
    displayName: "Daily Flex",
    weeklyPremium: 35,
    coveragePerHour: 50,
    maxPayoutPerEvent: 150,
    maxPayoutPerWeek: 750,
    maxHoursPerEvent: 3,
    description: "Pay only on work days. ₹150 per disruption. No weekly commitment.",
    triggerTypes: ["rain", "aqi", "flood", "curfew"],
  },
];

const seed = async () => {
  await connectDB();

  console.log("🌱 Seeding insurance plans...");

  for (const planData of PLANS) {
    const existing = await Plan.findOne({ name: planData.name });
    if (existing) {
      await Plan.findByIdAndUpdate(existing._id, planData);
      console.log(`↻ Updated: ${planData.displayName}`);
    } else {
      await Plan.create(planData);
      console.log(`✅ Created: ${planData.displayName}`);
    }
  }

  console.log("\n📋 Plans seeded:");
  const plans = await Plan.find().select("name displayName weeklyPremium coveragePerHour");
  plans.forEach((p) =>
    console.log(`  ${p.displayName}: ₹${p.weeklyPremium}/week | ₹${p.coveragePerHour}/hour`)
  );

  await mongoose.disconnect();
  console.log("\n✅ Done. Run `npm run dev` to start the server.");
};

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
