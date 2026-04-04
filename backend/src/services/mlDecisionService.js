const axios = require("axios");
const logger = require("../config/logger");

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://localhost:8000/insurance-decision";
const ML_HEALTH_URL = process.env.ML_HEALTH_URL || new URL("/health", ML_SERVICE_URL).toString();
const ML_TIMEOUT_MS = parseInt(process.env.ML_SERVICE_TIMEOUT_MS || "4000", 10);
const ML_MODEL_VERSION = process.env.ML_MODEL_VERSION || "premium_model1B.pkl";
const ACTIVE_USER_THRESHOLD_MS = 60 * 60 * 1000;
const MIN_CLAIM_AMOUNT = 50;
const CLAIM_AMOUNT_PER_COUNT = 50;
const DEFAULT_TEMPERATURE_C = 30;
const LOW_MOVEMENT_THRESHOLD_M = 200;
const HEAVY_RAIN_THRESHOLD_MM = 60;
const POLLUTION_THRESHOLD_AQI = 300;

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
  const temperatureFromEvent = event?.rawData?.temperature;
  const speedFromSnapshot = gpsSnapshot?.speed;
  const distanceMovedM = toNumber(gpsSnapshot?.distanceMovedM, gpsSnapshot ? 150 : 500);
  const rainfallMm = toNumber(rainfallFromEvent, 0);
  const aqi = toNumber(aqiFromEvent, 0);
  const speedKmh = toNumber(speedFromSnapshot, 0);
  const kycScore = toNumber(user?.kycScore, 0);
  const ipDistance = toNumber(ipDistanceKm, 0);
  const claimAmountValue = toNumber(
    claimAmount,
    Math.max(MIN_CLAIM_AMOUNT, claimCount * CLAIM_AMOUNT_PER_COUNT)
  );
  const activeUser =
    user?.lastActiveAt && Date.now() - new Date(user.lastActiveAt).getTime() <= ACTIVE_USER_THRESHOLD_MS;
  const lowMovement = toBinary(distanceMovedM < LOW_MOVEMENT_THRESHOLD_M);
  const highRiskZone = toBinary(
    rainfallMm > HEAVY_RAIN_THRESHOLD_MM || aqi > POLLUTION_THRESHOLD_AQI
  );

  return {
    rainfall_mm: rainfallMm,
    aqi,
    temperature: toNumber(temperatureFromEvent, DEFAULT_TEMPERATURE_C),
    speed_kmh: speedKmh,
    distance_moved_m: distanceMovedM,
    claim_amount: claimAmountValue,
    kyc_score: kycScore,
    ip_distance_km: ipDistance,
    low_movement: lowMovement,
    high_risk_zone: highRiskZone,
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
