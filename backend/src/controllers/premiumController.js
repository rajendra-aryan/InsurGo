const Plan = require("../models/Plan");
const Policy = require("../models/Policy");
const Claim = require("../models/Claim");
const { calculateDynamicPremium, estimateRiskScore, ZONE_RISK_REGISTRY } = require("../services/premiumService");

/**
 * POST /api/premium/calculate
 * Calculate dynamic premium given a planId and optional overrides.
 * Can be called without auth (for onboarding preview).
 */
const calculate = async (req, res, next) => {
  try {
    const { planId, zone, weeklyAvgIncome, kycScore, claimCount = 0 } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    // Build a synthetic worker profile from request params + logged-in user (if any)
    const workerProfile = req.user
      ? {
          ...req.user.toObject(),
          location: { ...req.user.location, zone: zone || req.user.location?.zone },
          weeklyAvgIncome: weeklyAvgIncome || req.user.weeklyAvgIncome,
          kycScore: kycScore !== undefined ? kycScore : req.user.kycScore,
        }
      : {
          location: { zone: zone || "default" },
          weeklyAvgIncome: weeklyAvgIncome || 5000,
          kycScore: kycScore || 50,
        };

    const claimsHistory = { claimCount: claimCount || 0, lastClaimDaysAgo: 999 };
    const result = calculateDynamicPremium(plan, workerProfile, claimsHistory);
    const riskScore = estimateRiskScore(workerProfile);

    res.json({
      success: true,
      data: {
        planId: plan._id,
        planName: plan.displayName,
        basePremium: plan.weeklyPremium,
        dynamicPremium: result.dynamicPremium,
        discount: result.discount,
        discountReason: result.discountReason,
        riskScore,
        breakdown: result.breakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/premium/zone-risk
 * Returns the risk factor for all configured zones — useful for frontend maps
 */
const getZoneRiskMap = async (req, res) => {
  const zones = Object.entries(ZONE_RISK_REGISTRY)
    .filter(([key]) => key !== "default")
    .map(([zone, riskFactor]) => ({
      zone,
      riskFactor,
      riskLevel:
        riskFactor <= 0.9 ? "low" : riskFactor <= 1.1 ? "moderate" : riskFactor <= 1.2 ? "high" : "very_high",
      discountOrSurcharge: riskFactor < 1 ? `${((1 - riskFactor) * 100).toFixed(0)}% discount` : `${((riskFactor - 1) * 100).toFixed(0)}% surcharge`,
    }));

  res.json({ success: true, data: { zones } });
};

/**
 * GET /api/premium/my-risk-profile  (Auth required)
 * Return the current worker's risk profile and what premium they'd pay
 */
const getMyRiskProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const plans = await Plan.find({ isActive: true });

    const riskScore = estimateRiskScore(user);
    const zone = user.location?.zone || "default";
    const zoneRiskFactor = ZONE_RISK_REGISTRY[zone] ?? 1.0;

    // Claims in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentClaims = await Claim.countDocuments({
      userId: user._id,
      status: "paid",
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Compute premium for all plans
    const premiumsByPlan = plans.map((plan) => {
      const result = calculateDynamicPremium(plan, user, { claimCount: recentClaims });
      return {
        planId: plan._id,
        planName: plan.displayName,
        basePremium: plan.weeklyPremium,
        dynamicPremium: result.dynamicPremium,
        discount: result.discount,
      };
    });

    res.json({
      success: true,
      data: {
        riskScore,
        riskLevel: riskScore < 0.3 ? "low" : riskScore < 0.6 ? "moderate" : "high",
        zone,
        zoneRiskFactor,
        kycScore: user.kycScore,
        recentClaims30Days: recentClaims,
        premiumsByPlan,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { calculate, getZoneRiskMap, getMyRiskProfile };
