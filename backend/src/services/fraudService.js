/**
 * InsurGo Fraud Detection Engine
 * ───────────────────────────────
 * Simplified implementation of the multi-layer system from the README.
 * Produces a fraud score 0–100 and a list of flags.
 *
 * Score actions:
 *   0–20   → Auto-approve
 *  21–50   → Manual review (24h hold)
 *  51–75   → Suspicious — block payout, request extra proof
 *  76–99   → High risk — reject + 7-day ban
 *   100    → Fraud ring — lock account
 */

const logger = require("../config/logger");

/**
 * Run all fraud checks for a claim candidate.
 *
 * @param {Object} user         - User document
 * @param {Object} policy       - Policy document
 * @param {Object} event        - Disruption event document
 * @param {Object} gpsSnapshot  - { lat, lng, speed, accuracy }
 * @param {Object} recentClaims - Array of recent claim docs for this user
 * @returns {Object}            - { fraudScore, fraudFlags, details, action }
 */
const evaluateFraud = (user, policy, event, gpsSnapshot = {}, recentClaims = []) => {
  const flags = [];
  const details = {};
  let score = 0;

  // ── Layer 1: GPS Movement Verification (weight: 25) ──────
  const gpsScore = checkGPS(gpsSnapshot, event, details);
  score += gpsScore * 0.25;
  if (gpsScore > 50) flags.push("GPS_ANOMALY");

  // ── Layer 2: Behavioral Pattern (weight: 30) ─────────────
  const behaviorScore = checkBehavior(recentClaims, event, details);
  score += behaviorScore * 0.30;
  if (behaviorScore > 50) flags.push("BEHAVIORAL_OUTLIER");

  // ── Layer 3: KYC Weakness (weight: 10) ───────────────────
  const kycScore = checkKYC(user, details);
  score += kycScore * 0.10;
  if (kycScore > 50) flags.push("KYC_WEAKNESS");

  // ── Layer 4: Account Age (weight: 15) ────────────────────
  const ageScore = checkAccountAge(user, details);
  score += ageScore * 0.15;
  if (ageScore > 70) flags.push("FRESH_ACCOUNT");

  // ── Layer 5: Policy Age (weight: 20) ─────────────────────
  const policyScore = checkPolicyAge(policy, recentClaims, details);
  score += policyScore * 0.20;
  if (policyScore > 60) flags.push("SUSPICIOUS_CLAIM_PATTERN");

  const finalScore = Math.min(100, Math.round(score));

  logger.debug(
    `Fraud eval for user ${user._id}: score=${finalScore}, flags=[${flags.join(",")}]`
  );

  return {
    fraudScore: finalScore,
    fraudFlags: flags,
    details,
    action: getAction(finalScore),
    autoApprove: finalScore <= 20,
  };
};

// ─── Layer Implementations ────────────────────────────────

const checkGPS = (gps, event, details) => {
  let score = 0;

  if (!gps || !gps.lat) {
    details.gps = "No GPS snapshot provided — moderate risk";
    return 40; // No GPS = uncertain
  }

  // Speed check: delivery workers should be 0-40 km/h
  if (gps.speed !== undefined) {
    if (gps.speed > 120) {
      score += 80;
      details.gpsSpeed = `Impossible speed: ${gps.speed} km/h`;
    } else if (gps.speed === 0) {
      score += 30;
      details.gpsSpeed = "Worker stationary during claimed disruption";
    } else {
      details.gpsSpeed = `Normal speed: ${gps.speed} km/h`;
    }
  }

  // Accuracy check: very precise GPS may indicate spoofing
  if (gps.accuracy !== undefined && gps.accuracy < 1) {
    score += 20;
    details.gpsAccuracy = `Suspiciously perfect GPS accuracy: ${gps.accuracy}m`;
  }

  details.gpsCheck = `GPS score: ${Math.min(100, score)}`;
  return Math.min(100, score);
};

const checkBehavior = (recentClaims, event, details) => {
  let score = 0;

  if (!recentClaims || recentClaims.length === 0) {
    details.behavior = "No recent claims — low risk";
    return 0;
  }

  // Check for duplicate claims on same event
  const claimsOnSameEvent = recentClaims.filter(
    (c) => c.eventId?.toString() === event._id?.toString()
  );
  if (claimsOnSameEvent.length > 0) {
    score += 90;
    details.duplicateClaim = `Duplicate claim detected for event ${event._id}`;
  }

  // Check claim frequency (more than 3 claims in last 24h)
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = recentClaims.filter((c) => new Date(c.createdAt) > last24h).length;
  if (recentCount >= 3) {
    score += 40;
    details.claimFrequency = `${recentCount} claims in last 24h — suspicious`;
  }

  // Check if all recent claim amounts are identical (fraud ring pattern)
  if (recentClaims.length >= 3) {
    const amounts = recentClaims.map((c) => c.payoutAmount);
    const allSame = amounts.every((a) => a === amounts[0]);
    if (allSame) {
      score += 25;
      details.amountPattern = "Identical claim amounts detected";
    }
  }

  details.behavior = `Behavior score: ${Math.min(100, score)}`;
  return Math.min(100, score);
};

const checkKYC = (user, details) => {
  const kycScore = user.kycScore || user.computeKYCScore?.() || 0;
  details.kycScore = kycScore;

  if (kycScore < 30) {
    details.kycStatus = "Very weak KYC — high risk";
    return 80;
  }
  if (kycScore < 50) {
    details.kycStatus = "Weak KYC — elevated risk";
    return 50;
  }
  if (kycScore < 70) {
    details.kycStatus = "Partial KYC";
    return 20;
  }
  details.kycStatus = "Strong KYC — low risk";
  return 0;
};

const checkAccountAge = (user, details) => {
  const createdAt = new Date(user.createdAt);
  const ageInDays = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
  details.accountAgeDays = ageInDays;

  if (ageInDays < 7) {
    details.accountAgeStatus = "Account < 7 days — high risk (possible fake)";
    return 85;
  }
  if (ageInDays < 30) {
    details.accountAgeStatus = "Account < 30 days — moderate risk";
    return 40;
  }
  details.accountAgeStatus = `Account ${ageInDays} days old — low risk`;
  return 0;
};

const checkPolicyAge = (policy, recentClaims, details) => {
  const policyCreatedAt = new Date(policy.createdAt);
  const policyAgeDays = Math.floor((Date.now() - policyCreatedAt) / (1000 * 60 * 60 * 24));
  details.policyAgeDays = policyAgeDays;

  let score = 0;

  // Claiming on day 1 of new policy = suspicious
  if (policyAgeDays < 1) {
    score += 60;
    details.policyStatus = "Claim on day 1 of new policy — suspicious";
  }

  // Too many claims this period
  const claimsThisPeriod = policy.claimsThisPeriod || 0;
  if (claimsThisPeriod >= 5) {
    score += 30;
    details.policyClaimsCount = `${claimsThisPeriod} claims this period — high frequency`;
  }

  return Math.min(100, score);
};

// ─── Action Decision ──────────────────────────────────────

const getAction = (score) => {
  if (score <= 20) return "auto_approve";
  if (score <= 50) return "manual_review";
  if (score <= 75) return "block_request_proof";
  if (score <= 99) return "reject_and_warn";
  return "lock_account";
};

module.exports = { evaluateFraud, getAction };
