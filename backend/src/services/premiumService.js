/**
 * InsurGo Dynamic Premium Calculation Engine
 * ───────────────────────────────────────────
 * Formula: DynamicPremium = BasePremium × ZoneRiskFactor × ActivityMultiplier × ClaimsMultiplier
 *
 * Zone Risk Factor: based on historical disruption frequency of the worker's zone
 *   - Historically safe zone (low waterlogging, good roads): factor < 1.0 → cheaper premium
 *   - High-risk zone (flood-prone, heavy AQI): factor > 1.0 → higher premium
 *
 * Activity Multiplier: based on how active the worker is on the platform
 *   - Higher activity = more exposure = slightly higher premium
 *
 * Claims Multiplier: no-claims bonus or penalty for high claim frequency
 */

const logger = require("../config/logger");

// ─── Zone Risk Registry ────────────────────────────────────
// In production: fetch from a geo-risk DB or ML model output
// For demo: seeded hardcoded values per Mumbai zone
const ZONE_RISK_REGISTRY = {
  "Mumbai-Andheri-West": 0.85,      // relatively safe, good drainage
  "Mumbai-Andheri-East": 1.10,      // moderate flood risk
  "Mumbai-Bandra": 0.90,
  "Mumbai-Kurla": 1.25,             // historically flood-prone
  "Mumbai-Dharavi": 1.30,
  "Mumbai-Sion": 1.20,
  "Mumbai-Dadar": 1.05,
  "Mumbai-Colaba": 0.80,
  "Mumbai-Borivali": 0.95,
  "Mumbai-Thane": 1.15,
  "Mumbai-Navi-Mumbai": 1.0,
  default: 1.0,                     // unknown zone → no adjustment
};

// ─── Premium Calculation ──────────────────────────────────

/**
 * Calculate the dynamic premium for a worker subscribing to a plan.
 *
 * @param {Object} plan         - Plan document (weeklyPremium, coveragePerHour, etc.)
 * @param {Object} worker       - User document (location, avgHourlyIncome, etc.)
 * @param {Object} claimsHistory - { claimCount, totalPaidOut, lastClaimDaysAgo }
 * @returns {Object}            - { dynamicPremium, discount, discountReason, breakdown }
 */
const calculateDynamicPremium = (plan, worker, claimsHistory = {}) => {
  const basePremium = plan.weeklyPremium;

  // ── 1. Zone Risk Factor ──────────────────────────────────
  const zone = worker.location?.zone || "default";
  const zoneRiskFactor = ZONE_RISK_REGISTRY[zone] ?? ZONE_RISK_REGISTRY["default"];

  // ── 2. Activity Multiplier ───────────────────────────────
  // Based on weekly avg income as a proxy for activity level
  // Workers earning more are more active, higher exposure
  const avgWeekly = worker.weeklyAvgIncome || 5000;
  let activityMultiplier;
  if (avgWeekly < 3000) activityMultiplier = 0.90;
  else if (avgWeekly < 6000) activityMultiplier = 1.0;
  else if (avgWeekly < 9000) activityMultiplier = 1.05;
  else activityMultiplier = 1.10;

  // ── 3. Claims History Multiplier ────────────────────────
  const { claimCount = 0, lastClaimDaysAgo = 999 } = claimsHistory;
  let claimsMultiplier = 1.0;
  let claimsNote = "";

  if (claimCount === 0) {
    claimsMultiplier = 0.95; // 5% no-claims bonus
    claimsNote = "No-claims bonus applied";
  } else if (claimCount >= 5 && lastClaimDaysAgo < 30) {
    claimsMultiplier = 1.10; // frequent claimer
    claimsNote = "High claim frequency adjustment";
  }

  // ── 4. KYC Discount ─────────────────────────────────────
  const kycScore = worker.kycScore || 0;
  const kycDiscount = kycScore >= 90 ? 0.95 : 1.0; // 5% off for fully verified

  // ── 5. Final Calculation ─────────────────────────────────
  const rawPremium =
    basePremium * zoneRiskFactor * activityMultiplier * claimsMultiplier * kycDiscount;

  // Round to nearest rupee
  const dynamicPremium = Math.round(rawPremium);
  const discount = Math.max(0, basePremium - dynamicPremium);
  const discountPct = ((discount / basePremium) * 100).toFixed(1);

  const breakdown = {
    basePremium,
    zoneRiskFactor,
    zone,
    activityMultiplier,
    claimsMultiplier,
    claimsNote,
    kycDiscount,
    rawPremium: rawPremium.toFixed(2),
    dynamicPremium,
    discount,
    discountPct: `${discountPct}%`,
  };

  logger.debug(`Premium calc for ${worker.name}: ₹${basePremium} → ₹${dynamicPremium}`);

  return {
    dynamicPremium,
    discount,
    discountReason: claimsNote || (discount > 0 ? "Loyalty & KYC discount" : null),
    zoneRiskFactor,
    breakdown,
  };
};

/**
 * Compute payout for an eligible claim.
 *
 * @param {Object} policy  - Active policy (coveragePerHour, maxPayoutPerEvent, maxPayoutPerWeek)
 * @param {number} eventDurationHours - How many hours the disruption lasted
 * @param {number} alreadyPaidThisWeek - ₹ already paid to this worker this policy period
 * @returns {Object} - { eligibleHours, grossPayout, payoutAmount, cappedBy }
 */
const calculatePayout = (policy, eventDurationHours, alreadyPaidThisWeek = 0) => {
  const maxHours = Math.min(eventDurationHours, policy.maxHoursPerEvent || 6);
  const grossPayout = maxHours * policy.coveragePerHour;

  // Apply per-event cap
  const eventCapped = Math.min(grossPayout, policy.maxPayoutPerEvent);

  // Apply weekly cap
  const remainingWeeklyCap = Math.max(0, policy.maxPayoutPerWeek - alreadyPaidThisWeek);
  const payoutAmount = Math.min(eventCapped, remainingWeeklyCap);

  const cappedBy =
    payoutAmount < grossPayout
      ? payoutAmount === eventCapped
        ? "event_cap"
        : "weekly_cap"
      : null;

  return {
    eligibleHours: maxHours,
    grossPayout,
    payoutAmount,
    coveragePerHour: policy.coveragePerHour,
    cappedBy,
  };
};

/**
 * Estimate risk score for a worker (0–1 scale).
 * Higher = higher risk = higher premium.
 */
const estimateRiskScore = (worker) => {
  const zone = worker.location?.zone || "default";
  const zoneRisk = ZONE_RISK_REGISTRY[zone] ?? 1.0;

  // Normalize zone risk to 0-1
  const normalizedZone = Math.min(1, (zoneRisk - 0.7) / 0.8);

  // KYC inversely reduces risk
  const kycFactor = 1 - (worker.kycScore || 0) / 200;

  const riskScore = (normalizedZone * 0.6 + kycFactor * 0.4);
  return Math.min(1, Math.max(0, parseFloat(riskScore.toFixed(3))));
};

module.exports = { calculateDynamicPremium, calculatePayout, estimateRiskScore, ZONE_RISK_REGISTRY };
