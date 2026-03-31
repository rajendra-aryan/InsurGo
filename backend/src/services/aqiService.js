const axios = require("axios");
const logger = require("../config/logger");

const BASE_URL = process.env.WAQI_BASE_URL;
const API_KEY = process.env.WAQI_API_KEY;

const AQI_THRESHOLD = parseInt(process.env.AQI_THRESHOLD) || 300;

/**
 * Fetch AQI data for a city from the WAQI API.
 * Free API — get your token at https://aqicn.org/data-platform/token/
 */
const getCityAQI = async (city = "mumbai") => {
  try {
    const { data } = await axios.get(`${BASE_URL}/feed/${city}/`, {
      params: { token: API_KEY },
      timeout: 8000,
    });

    if (data.status !== "ok") {
      throw new Error(`WAQI returned status: ${data.status}`);
    }

    const aqiValue = data.data.aqi;
    const dominantPollutant = data.data.dominentpol || "pm25";
    const stationName = data.data.city?.name || city;

    return {
      city: stationName,
      aqiValue,
      dominantPollutant,
      lat: data.data.city?.geo?.[0],
      lng: data.data.city?.geo?.[1],
      raw: data.data,
      thresholdBreached: aqiValue >= AQI_THRESHOLD,
      threshold: AQI_THRESHOLD,
      severity: getAQISeverity(aqiValue),
    };
  } catch (error) {
    logger.error(`AQIService error: ${error.message}`);
    throw new Error(`WAQI API failed: ${error.message}`);
  }
};

/**
 * Map AQI value to severity label (WHO + India AQI standard).
 */
const getAQISeverity = (aqi) => {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 200) return "unhealthy_sensitive";
  if (aqi <= 300) return "unhealthy";
  if (aqi <= 400) return "very_unhealthy";
  return "hazardous";
};

module.exports = { getCityAQI, getAQISeverity, AQI_THRESHOLD };
