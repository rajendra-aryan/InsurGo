/**
 * InsurGo Automated Trigger Service
 * ────────────────────────────────────────────────────────
 * This is the heart of the parametric insurance model.
 *
 * Pipeline (runs every 15 min via cron):
 *   1. Poll OpenWeather → check rain threshold
 *   2. Poll WAQI       → check AQI threshold
 *   3. If threshold breached → create/update Event
 *   4. Find all workers in affected zones with active policies
 *   5. For each eligible worker → run fraud check → compute payout
 *   6. Auto-approve (score ≤ 20) → initiate Razorpay payout
 *   7. Flag others for manual review or reject
 */

const logger = require("../config/logger");
const User = require("../models/User");
const Policy = require("../models/Policy");
const Event = require("../models/Event");
const Claim = require("../models/Claim");
const { getCurrentWeather } = require("./weatherService");
const { getCityAQI } = require("./aqiService");
const { calculatePayout } = require("./premiumService");
const { evaluateFraud } = require("./fraudService");
const { createFundAccount, initiatePayout } = require("./razorpayService");
const { getInsuranceDecision } = require("./mlDecisionService");

const CITIES = ["Mumbai"]; // Extend to support multiple cities

/**
 * Main pipeline — called by the cron job.
 */
const runTriggerPipeline = async () => {
  logger.info("🔄 Trigger pipeline started...");

  for (const city of CITIES) {
    await checkAndProcessCity(city);
  }

  logger.info("✅ Trigger pipeline complete.");
};

const checkAndProcessCity = async (city) => {
  // ── 1. Check Weather ─────────────────────────────────────
  let weatherResult = null;
  try {
    weatherResult = await getCurrentWeather(city);
    logger.info(
      `Weather [${city}]: ${weatherResult.rainfallMm}mm rain | threshold: ${weatherResult.threshold}mm | breached: ${weatherResult.thresholdBreached}`
    );

    if (weatherResult.thresholdBreached) {
      await processDisruption({
        type: weatherResult.triggerType,
        city,
        triggerValue: weatherResult.rainfallMm,
        triggerThreshold: weatherResult.threshold,
        source: "openweather",
        rawData: {
          rainfallMm: weatherResult.rainfallMm,
          weatherDescription: weatherResult.description,
        },
        lat: weatherResult.lat,
        lng: weatherResult.lng,
      });
    }
  } catch (error) {
    logger.error(`Weather check failed for ${city}: ${error.message}`);
  }

  // ── 2. Check AQI ─────────────────────────────────────────
  try {
    const aqiResult = await getCityAQI(city.toLowerCase());
    logger.info(
      `AQI [${city}]: ${aqiResult.aqiValue} | threshold: ${aqiResult.threshold} | breached: ${aqiResult.thresholdBreached}`
    );

    if (aqiResult.thresholdBreached) {
      await processDisruption({
        type: "aqi",
        city,
        triggerValue: aqiResult.aqiValue,
        triggerThreshold: aqiResult.threshold,
        source: "waqi",
        rawData: {
          aqiValue: aqiResult.aqiValue,
          aqiPollutant: aqiResult.dominantPollutant,
        },
        lat: aqiResult.lat,
        lng: aqiResult.lng,
      });
    }
  } catch (error) {
    logger.error(`AQI check failed for ${city}: ${error.message}`);
  }
};

/**
 * Process a confirmed disruption event:
 *   - Create/find existing event record
 *   - Find eligible workers
 *   - Run fraud + compute payouts
 */
const processDisruption = async ({
  type, city, triggerValue, triggerThreshold, source, rawData, lat, lng,
}) => {
  logger.info(`🚨 Disruption detected: type=${type} | city=${city} | value=${triggerValue}`);

  // Avoid duplicate event for same type + city within last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  let event = await Event.findOne({
    type,
    city,
    isActive: true,
    detectedAt: { $gte: twoHoursAgo },
  });

  if (!event) {
    const severityRatio = triggerValue / triggerThreshold;
    let severity = "moderate";
    if (severityRatio >= 1.5) severity = "extreme";
    else if (severityRatio >= 1.2) severity = "high";

    event = await Event.create({
      type,
      city,
      severity,
      rawData,
      triggerValue,
      triggerThreshold,
      source,
      lat,
      lng,
      zones: [`${city}-All`],
    });

    logger.info(`📋 New event created: ${event._id} | ${type} in ${city}`);
  } else {
    logger.info(`ℹ️ Using existing event: ${event._id}`);
  }

  // Find all workers with active policies in this city who were recently active
  const sixtyMinsAgo = new Date(Date.now() - 60 * 60 * 1000);

  const activePolicies = await Policy.find({ isActive: true, premiumPaid: true })
    .populate({
      path: "userId",
      match: {
        "location.city": city,
        lastActiveAt: { $gte: sixtyMinsAgo },
        isBlocked: false,
      },
    })
    .lean();

  const eligiblePolicies = activePolicies.filter(
    (p) => p.userId !== null && p.endDate > new Date() && p.startDate <= new Date()
  );

  logger.info(`👥 Eligible workers found: ${eligiblePolicies.length}`);

  // Process each eligible worker
  for (const policy of eligiblePolicies) {
    await processSingleWorkerClaim(policy, event);
  }

  // Mark event as processed
  await Event.findByIdAndUpdate(event._id, {
    claimsProcessed: eligiblePolicies.length,
    isProcessed: true,
  });
};

/**
 * Process a single worker's claim for an event.
 */
const processSingleWorkerClaim = async (policy, event) => {
  const user = policy.userId;

  try {
    // Skip if already claimed for this event
    const existing = await Claim.findOne({ userId: user._id, eventId: event._id });
    if (existing) {
      logger.debug(`Skipping duplicate claim for user ${user._id} on event ${event._id}`);
      return;
    }

    // Estimate event duration (ongoing = 2h default; use actual if resolved)
    const eventDurationHours = event.durationHours || 2;

    // Get already-paid amount this policy period
    const alreadyPaid = policy.totalPayoutThisPeriod || 0;

    // Compute payout
    const payoutCalc = calculatePayout(policy, eventDurationHours, alreadyPaid);

    if (payoutCalc.payoutAmount <= 0) {
      logger.info(`User ${user._id} weekly cap reached — skipping`);
      return;
    }

    // Get recent claims for fraud check
    const recentClaims = await Claim.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Run fraud detection
    const fraudResult = evaluateFraud(user, policy, event, null, recentClaims);
    const mlDecision = await getInsuranceDecision({
      user,
      event,
      claimAmount: payoutCalc.payoutAmount,
      claimCount: recentClaims.length,
    });
    const triggerMismatch = mlDecision.available && mlDecision.claimTriggered === false;

    // Create claim record
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
      triggerSource: "auto",
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
      `📄 Claim created: ${claim._id} | user: ${user._id} | ₹${payoutCalc.payoutAmount} | fraud: ${fraudResult.fraudScore} | action: ${fraudResult.action}`
    );

    // Auto-approve and pay if fraud score is low
    if (fraudResult.action === "auto_approve" && !triggerMismatch) {
      await processPayout(claim, user, policy, payoutCalc.payoutAmount);
    } else if (triggerMismatch) {
      await Claim.findByIdAndUpdate(claim._id, {
        status: "manual_review",
        reviewNote: "ML trigger mismatch: claim requires manual review",
      });
    } else if (fraudResult.action === "lock_account") {
      await User.findByIdAndUpdate(user._id, {
        isBlocked: true,
        blockReason: "Fraud ring detected by automated system",
      });
      logger.warn(`🔒 Account locked: ${user._id} | score: ${fraudResult.fraudScore}`);
    }
  } catch (error) {
    logger.error(`Error processing claim for user ${user._id}: ${error.message}`);
  }
};

/**
 * Initiate Razorpay payout for an auto-approved claim.
 */
const processPayout = async (claim, user, policy, amount) => {
  try {
    // Check if user has a bank account configured
    if (!user.bankAccount?.accountNumber || !user.bankAccount?.ifsc) {
      logger.warn(`User ${user._id} has no bank account — payout queued`);
      await Claim.findByIdAndUpdate(claim._id, {
        status: "manual_review",
        reviewNote: "No bank account on file — worker must add bank details",
      });
      return;
    }

    // Create fund account if not exists
    let fundAccountId = user.razorpayFundAccountId;
    if (!fundAccountId) {
      fundAccountId = await createFundAccount(user);
      await User.findByIdAndUpdate(user._id, { razorpayFundAccountId: fundAccountId });
    }

    // Initiate payout (amount in paise)
    const payoutResult = await initiatePayout({
      fundAccountId,
      amountInPaise: amount * 100,
      claimId: claim._id.toString(),
      workerName: user.name,
    });

    // Update claim and policy
    await Claim.findByIdAndUpdate(claim._id, {
      status: "paid",
      paidAt: new Date(),
      processedAt: new Date(),
      razorpayPayoutId: payoutResult.razorpayPayoutId,
      razorpayPayoutStatus: payoutResult.status,
    });

    await Policy.findByIdAndUpdate(policy._id, {
      $inc: {
        totalPayoutThisPeriod: amount,
        claimsThisPeriod: 1,
      },
    });

    logger.info(
      `💸 Payout success: ₹${amount} → ${user.name} | Razorpay: ${payoutResult.razorpayPayoutId}`
    );
  } catch (error) {
    logger.error(`Payout failed for claim ${claim._id}: ${error.message}`);
    await Claim.findByIdAndUpdate(claim._id, {
      status: "manual_review",
      reviewNote: `Payout failed: ${error.message}`,
    });
  }
};

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

// ─── Manual Trigger (for demo/testing) ───────────────────

/**
 * Manually trigger a disruption event — used for demos.
 */
const manualTrigger = async ({ type, city, triggerValue, adminNote }) => {
  const thresholds = { rain: 60, flood: 60, aqi: 300, curfew: 1 };
  const threshold = thresholds[type] || 1;

  await processDisruption({
    type,
    city: city || "Mumbai",
    triggerValue: triggerValue || threshold * 1.5,
    triggerThreshold: threshold,
    source: "manual",
    rawData: { adminNote },
    lat: 19.076,
    lng: 72.877,
  });
};

module.exports = { runTriggerPipeline, manualTrigger, processPayout };
