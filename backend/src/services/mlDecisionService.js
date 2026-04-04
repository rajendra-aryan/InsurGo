const axios = require("axios");
const logger = require("../config/logger");

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://localhost:8000/insurance-decision";
const ML_HEALTH_URL =
  process.env.ML_HEALTH_URL || ML_SERVICE_URL.replace("/insurance-decision", "/health");
const ML_TIMEOUT_MS = parseInt(process.env.ML_SERVICE_TIMEOUT_MS || "4000", 10);
const ML_MODEL_VERSION = process.env.ML_MODEL_VERSION || "premium_model1B.pkl";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBinary = (value) => (value ? 1 : 0);

const buildMlPayload = ({
  user = {},
  event = null,
  claimAmount = 0,
  gpsSnapshot = null,
  claimCount = 0,
  ipDistanceKm = 0,
}) => {
  const rainfallFromEvent = event?.rawData?.rainfallMm ?? event?.triggerValue;
  const aqiFromEvent = event?.rawData?.aqiValue ?? (event?.type === "aqi" ? event?.triggerValue : 0);
  const distanceMovedM = toNumber(gpsSnapshot?.distanceMovedM, gpsSnapshot ? 150 : 500);
  const activeUser =
    user?.lastActiveAt && Date.now() - new Date(user.lastActiveAt).getTime() <= 60 * 60 * 1000;

  return {
    rainfall_mm: toNumber(rainfallFromEvent, 0),
    aqi: toNumber(aqiFromEvent, 0),
    claim_amount: toNumber(claimAmount, Math.max(50, claimCount * 50)),
    ip_distance_km: toNumber(ipDistanceKm, 0),
    distance_moved_m: distanceMovedM,
    is_active: toBinary(activeUser || !!gpsSnapshot),
  };
};

const getInsuranceDecision = async (context = {}) => {
  const payload = buildMlPayload(context);

  try {
    const response = await axios.post(ML_SERVICE_URL, payload, { timeout: ML_TIMEOUT_MS });
    const data = response?.data || {};

    return {
      available: true,
      provider: "fastapi",
      modelVersion: ML_MODEL_VERSION,
      decisionAt: new Date(),
      payload,
      riskScore: toNumber(data.risk_score, null),
      predictedPremium: toNumber(data.predicted_premium, null),
      claimTriggered: typeof data.claim_triggered === "boolean" ? data.claim_triggered : null,
      triggerReasons: Array.isArray(data.reasons) ? data.reasons : [],
      rawResponse: data,
    };
  } catch (error) {
    logger.warn(`ML decision unavailable: ${error.message}`);
    return {
      available: false,
      provider: "fastapi",
      modelVersion: ML_MODEL_VERSION,
      decisionAt: new Date(),
      payload,
      riskScore: null,
      predictedPremium: null,
      claimTriggered: null,
      triggerReasons: [],
      rawResponse: null,
      error: error.message,
    };
  }
};

const getMlHealth = async () => {
  try {
    const response = await axios.get(ML_HEALTH_URL, { timeout: ML_TIMEOUT_MS });
    return {
      ok: true,
      status: response.status,
      data: response.data,
      url: ML_HEALTH_URL,
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      message: error.message,
      url: ML_HEALTH_URL,
    };
  }
};

module.exports = { getInsuranceDecision, getMlHealth, buildMlPayload };
