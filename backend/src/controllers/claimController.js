const Claim = require("../models/Claim");
const Policy = require("../models/Policy");
const Event = require("../models/Event");
const User = require("../models/User");
const { evaluateFraud } = require("../services/fraudService");
const { calculatePayout } = require("../services/premiumService");
const { processPayout } = require("../services/triggerService");
const { getInsuranceDecision } = require("../services/mlDecisionService");
const logger = require("../config/logger");

/**
 * GET /api/claims/my
 * Get all claims for the current logged-in worker
 */
const getMyClaims = async (req, res, next) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [claims, total] = await Promise.all([
      Claim.find(filter)
        .populate("eventId", "type severity city detectedAt triggerValue")
        .populate("policyId", "planName coveragePerHour")
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Claim.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        claims,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/claims/:claimId
 * Get single claim detail
 */
const getClaimById = async (req, res, next) => {
  try {
    const claim = await Claim.findOne({
      _id: req.params.claimId,
      userId: req.user._id,
    })
      .populate("eventId")
      .populate("policyId");

    if (!claim) return res.status(404).json({ success: false, message: "Claim not found" });

    res.json({ success: true, data: { claim } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/claims/manual
 * Manual claim submission by worker (for disruptions not auto-triggered yet).
 * Worker submits their GPS + active policy; system validates and processes.
 */
const submitManualClaim = async (req, res, next) => {
  try {
    const { eventId, gpsSnapshot } = req.body;
    const user = req.user;

    // Find the event
    const event = await Event.findById(eventId);
    if (!event || !event.isActive) {
      return res.status(404).json({ success: false, message: "Active disruption event not found" });
    }

    // Check for active policy
    const policy = await Policy.findOne({
      userId: user._id,
      isActive: true,
      premiumPaid: true,
    });

    if (!policy || !policy.isValid()) {
      return res.status(400).json({
        success: false,
        message: "No active policy found. Please subscribe to a plan first.",
      });
    }

    // Check duplicate claim
    const existing = await Claim.findOne({ userId: user._id, eventId: event._id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted a claim for this event.",
        data: { existingClaim: existing },
      });
    }

    // Compute payout
    const alreadyPaid = policy.totalPayoutThisPeriod || 0;
    const eventDuration = event.durationHours || 2;
    const payoutCalc = calculatePayout(policy, eventDuration, alreadyPaid);

    if (payoutCalc.payoutAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Weekly payout cap reached. No more payouts available this policy period.",
      });
    }

    // Fraud detection (with GPS snapshot)
    const recentClaims = await Claim.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean();
    const fraudResult = evaluateFraud(user, policy, event, gpsSnapshot, recentClaims);
    const mlDecision = await getInsuranceDecision({
      user,
      event,
      gpsSnapshot,
      claimAmount: payoutCalc.payoutAmount,
      claimCount: recentClaims.length,
    });
    const triggerMismatch = mlDecision.available && mlDecision.claimTriggered === false;

    // Create claim
    const claim = await Claim.create({
      userId: user._id,
      policyId: policy._id,
      eventId: event._id,
      eligibleHours: payoutCalc.eligibleHours,
      coveragePerHour: payoutCalc.coveragePerHour,
      grossPayout: payoutCalc.grossPayout,
      payoutAmount: payoutCalc.payoutAmount,
      fraudScore: fraudResult.fraudScore,
      fraudFlags: fraudResult.fraudFlags,
      fraudDetails: fraudResult.details,
      status: mapActionToStatus(fraudResult.action),
      gpsSnapshot: gpsSnapshot || {},
      triggerSource: "manual",
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
    });

    logger.info(
      `Manual claim: ${claim._id} | user: ${user._id} | score: ${fraudResult.fraudScore} | action: ${fraudResult.action}`
    );

    // Auto-process if fraud score is low
    if (fraudResult.action === "auto_approve" && !triggerMismatch) {
      await processPayout(claim, user, policy, payoutCalc.payoutAmount);
      await claim.reload?.();
    } else if (triggerMismatch) {
      await Claim.findByIdAndUpdate(claim._id, {
        status: "manual_review",
        reviewNote: "ML trigger mismatch: claim requires manual review",
      });
    }

    // Handle account lock
    if (fraudResult.action === "lock_account") {
      await User.findByIdAndUpdate(user._id, {
        isBlocked: true,
        blockReason: "Fraud detection triggered — account locked",
      });
    }

    const refreshedClaim = await Claim.findById(claim._id);

    res.status(201).json({
      success: true,
      message: getClaimMessage(fraudResult.action),
      data: {
        claim: refreshedClaim,
        fraud: {
          score: fraudResult.fraudScore,
          action: fraudResult.action,
          flags: fraudResult.fraudFlags,
        },
        mlDecision: {
          available: mlDecision.available,
          claimTriggered: mlDecision.claimTriggered,
          triggerReasons: mlDecision.triggerReasons,
          modelVersion: mlDecision.modelVersion,
        },
        payout: {
          amount: payoutCalc.payoutAmount,
          eligibleHours: payoutCalc.eligibleHours,
          cappedBy: payoutCalc.cappedBy,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/claims/stats
 * Summary stats for the current worker
 */
const getMyClaimStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [totalClaims, paidClaims, pendingClaims, rejectedClaims] = await Promise.all([
      Claim.countDocuments({ userId }),
      Claim.countDocuments({ userId, status: "paid" }),
      Claim.countDocuments({ userId, status: { $in: ["pending", "approved", "manual_review"] } }),
      Claim.countDocuments({ userId, status: "rejected" }),
    ]);

    const totalPaidOut = await Claim.aggregate([
      { $match: { userId, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$payoutAmount" } } },
    ]);

    res.json({
      success: true,
      data: {
        totalClaims,
        paidClaims,
        pendingClaims,
        rejectedClaims,
        totalPaidOut: totalPaidOut[0]?.total || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Review & Override ─────────────────────────────

/**
 * PATCH /api/claims/:claimId/review  (Admin)
 * Manually approve or reject a claim in manual_review status
 */
const reviewClaim = async (req, res, next) => {
  try {
    const { decision, note } = req.body; // decision: "approve" | "reject"

    const claim = await Claim.findById(req.params.claimId)
      .populate("userId")
      .populate("policyId");

    if (!claim) return res.status(404).json({ success: false, message: "Claim not found" });

    if (claim.status !== "manual_review") {
      return res.status(400).json({
        success: false,
        message: `Claim is already in status: ${claim.status}`,
      });
    }

    if (decision === "approve") {
      await processPayout(claim, claim.userId, claim.policyId, claim.payoutAmount);
      claim.reviewNote = note || "Manually approved by admin";
      claim.processedAt = new Date();
    } else if (decision === "reject") {
      claim.status = "rejected";
      claim.rejectionReason = note || "Rejected by admin after review";
      claim.processedAt = new Date();
      await claim.save();
    } else {
      return res.status(400).json({ success: false, message: "decision must be 'approve' or 'reject'" });
    }

    const updated = await Claim.findById(claim._id);
    res.json({ success: true, data: { claim: updated } });
  } catch (error) {
    next(error);
  }
};

// ─── Helpers ──────────────────────────────────────────────

const mapActionToStatus = (action) => {
  const map = {
    auto_approve: "approved",
    manual_review: "manual_review",
    block_request_proof: "manual_review",
    reject_and_warn: "rejected",
    lock_account: "rejected",
  };
  return map[action] || "pending";
};

const getClaimMessage = (action) => {
  const messages = {
    auto_approve: "✅ Claim auto-approved! Payout initiated.",
    manual_review: "⏳ Claim submitted and is under review. You will be notified within 24 hours.",
    block_request_proof: "📋 Additional verification required. Please submit supporting documents.",
    reject_and_warn: "❌ Claim rejected. Suspicious activity detected.",
    lock_account: "🔒 Account has been suspended due to fraud detection.",
  };
  return messages[action] || "Claim submitted.";
};

module.exports = { getMyClaims, getClaimById, submitManualClaim, getMyClaimStats, reviewClaim };
