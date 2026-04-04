const Policy = require("../models/Policy");
const Plan = require("../models/Plan");
const Claim = require("../models/Claim");
const User = require("../models/User");
const { calculateDynamicPremium, estimateRiskScore } = require("../services/premiumService");
const { createPremiumOrder, verifyPaymentSignature } = require("../services/razorpayService");
const { getInsuranceDecision } = require("../services/mlDecisionService");
const logger = require("../config/logger");
const MIN_PREMIUM = 1;

/**
 * GET /api/policies/plans
 * List all available insurance plans
 */
const getPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort("weeklyPremium");
    res.json({ success: true, count: plans.length, data: { plans } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/policies/plans/:planId/quote
 * Get a personalised dynamic premium quote for a specific plan
 */
const getQuote = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.planId);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const user = req.user;

    // Fetch claims history for the user
    const claimsHistory = await getClaimsHistory(user._id);

    const result = calculateDynamicPremium(plan, user, claimsHistory);
    const fallbackRiskScore = estimateRiskScore(user);
    const mlDecision = await getInsuranceDecision({
      user,
      claimAmount: plan.weeklyPremium,
      claimCount: claimsHistory.claimCount,
    });
    const riskScore = mlDecision.riskScore ?? fallbackRiskScore;
    const dynamicPremium = mlDecision.predictedPremium
      ? Math.max(MIN_PREMIUM, Math.round(mlDecision.predictedPremium))
      : result.dynamicPremium;

    res.json({
      success: true,
      data: {
        plan: { id: plan._id, name: plan.displayName, basePremium: plan.weeklyPremium },
        quote: {
          dynamicPremium,
          discount: result.discount,
          discountReason: result.discountReason,
          riskScore,
          zoneRiskFactor: result.zoneRiskFactor,
          breakdown: result.breakdown,
          coveragePerHour: plan.coveragePerHour,
          maxPayoutPerEvent: plan.maxPayoutPerEvent,
          maxPayoutPerWeek: plan.maxPayoutPerWeek,
          mlDecision: {
            available: mlDecision.available,
            modelVersion: mlDecision.modelVersion,
            decisionAt: mlDecision.decisionAt,
            triggerReasons: mlDecision.triggerReasons,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/policies/subscribe
 * Subscribe to a plan → creates Razorpay order for premium payment
 */
const subscribe = async (req, res, next) => {
  try {
    const { planId } = req.body;
    const user = req.user;

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: "Plan not found or inactive" });
    }

    // Check if already has an active policy
    const existingPolicy = await Policy.findOne({ userId: user._id, isActive: true });
    if (existingPolicy && existingPolicy.isValid()) {
      return res.status(400).json({
        success: false,
        message: "You already have an active policy. Cancel it first or wait for it to expire.",
        data: { policy: existingPolicy },
      });
    }

    // Compute dynamic premium
    const claimsHistory = await getClaimsHistory(user._id);
    const premiumResult = calculateDynamicPremium(plan, user, claimsHistory);
    const fallbackRiskScore = estimateRiskScore(user);
    const mlDecision = await getInsuranceDecision({
      user,
      claimAmount: plan.weeklyPremium,
      claimCount: claimsHistory.claimCount,
    });
    const riskScore = mlDecision.riskScore ?? fallbackRiskScore;
    const dynamicPremium = mlDecision.predictedPremium
      ? Math.max(MIN_PREMIUM, Math.round(mlDecision.predictedPremium))
      : premiumResult.dynamicPremium;
    const premiumDiscount = Math.max(0, plan.weeklyPremium - dynamicPremium);

    // Create Razorpay order for premium collection
    const amountInPaise = dynamicPremium * 100;
    const razorpayOrder = await createPremiumOrder(amountInPaise, `temp_${user._id}_${planId}`);

    // Create policy in pending state (premiumPaid = false until payment confirmed)
    const startDate = new Date();
    const policy = await Policy.create({
      userId: user._id,
      planId: plan._id,
      planName: plan.name,
      weeklyPremium: plan.weeklyPremium,
      coveragePerHour: plan.coveragePerHour,
      maxPayoutPerEvent: plan.maxPayoutPerEvent,
      maxPayoutPerWeek: plan.maxPayoutPerWeek,
      dynamicPremium,
      premiumDiscount,
      premiumDiscountReason: premiumResult.discountReason,
      riskScore,
      zoneRiskFactor: premiumResult.zoneRiskFactor,
      mlDecision: {
        modelVersion: mlDecision.modelVersion,
        provider: mlDecision.provider,
        decisionAt: mlDecision.decisionAt,
        riskScore: mlDecision.riskScore,
        predictedPremium: mlDecision.predictedPremium,
        claimTriggered: mlDecision.claimTriggered,
        triggerReasons: mlDecision.triggerReasons,
        payload: mlDecision.payload,
        available: mlDecision.available,
      },
      startDate,
      endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      razorpayOrderId: razorpayOrder.id,
      premiumPaid: false,
    });

    logger.info(`Policy created (pending payment): ${policy._id} | user: ${user._id}`);

    res.status(201).json({
      success: true,
      message: "Policy created. Complete payment to activate.",
      data: {
        policy,
        payment: {
          orderId: razorpayOrder.id,
          amount: amountInPaise,
          currency: "INR",
          keyId: process.env.RAZORPAY_KEY_ID,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/policies/:policyId/confirm-payment
 * Called after Razorpay payment success — verifies signature and activates policy
 */
const confirmPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const policy = await Policy.findOne({
      _id: req.params.policyId,
      userId: req.user._id,
    });

    if (!policy) {
      return res.status(404).json({ success: false, message: "Policy not found" });
    }

    // Verify payment signature
    const isValid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValid) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    policy.premiumPaid = true;
    policy.razorpayPaymentId = razorpayPaymentId;
    await policy.save();

    logger.info(`Policy activated: ${policy._id} | user: ${req.user._id}`);

    res.json({
      success: true,
      message: "🎉 Policy activated! You are now protected.",
      data: { policy },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/policies/my
 * Get current user's policies (active + history)
 */
const getMyPolicies = async (req, res, next) => {
  try {
    const policies = await Policy.find({ userId: req.user._id })
      .populate("planId", "displayName triggerTypes")
      .sort({ createdAt: -1 });

    const active = policies.find((p) => p.isValid());

    res.json({
      success: true,
      data: {
        active: active || null,
        history: policies,
        totalPolicies: policies.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/policies/:policyId/cancel
 * Cancel an active policy
 */
const cancelPolicy = async (req, res, next) => {
  try {
    const policy = await Policy.findOne({
      _id: req.params.policyId,
      userId: req.user._id,
      isActive: true,
    });

    if (!policy) {
      return res.status(404).json({ success: false, message: "Active policy not found" });
    }

    policy.isActive = false;
    policy.cancelledAt = new Date();
    policy.cancelReason = req.body.reason || "Cancelled by user";
    await policy.save();

    res.json({ success: true, message: "Policy cancelled successfully", data: { policy } });
  } catch (error) {
    next(error);
  }
};

// ─── Helper ───────────────────────────────────────────────

const getClaimsHistory = async (userId) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const claims = await Claim.find({
    userId,
    status: "paid",
    createdAt: { $gte: thirtyDaysAgo },
  }).lean();

  const lastClaim = await Claim.findOne({ userId, status: "paid" }).sort({ createdAt: -1 }).lean();
  const lastClaimDaysAgo = lastClaim
    ? Math.floor((Date.now() - new Date(lastClaim.createdAt)) / (1000 * 60 * 60 * 24))
    : 999;

  return { claimCount: claims.length, lastClaimDaysAgo };
};

module.exports = { getPlans, getQuote, subscribe, confirmPayment, getMyPolicies, cancelPolicy };
