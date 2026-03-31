const axios = require("axios");
const logger = require("../config/logger");

const BASE_URL = process.env.OPENWEATHER_BASE_URL;
const API_KEY = process.env.OPENWEATHER_API_KEY;

// Threshold from env (default: 60mm)
const RAIN_THRESHOLD = parseFloat(process.env.RAIN_THRESHOLD_MM) || 60;

/**
 * Fetch current weather for a city.
 * Returns parsed rainfall data and whether threshold is breached.
 */
const getCurrentWeather = async (city = "Mumbai") => {
  try {
    const { data } = await axios.get(`${BASE_URL}/weather`, {
      params: { q: city, appid: API_KEY, units: "metric" },
      timeout: 8000,
    });

    // OpenWeather returns rainfall in `rain.1h` (last 1 hour, mm)
    const rainfallMm = data.rain?.["1h"] || data.rain?.["3h"] || 0;
    const description = data.weather?.[0]?.description || "clear";

    return {
      city: data.name,
      lat: data.coord.lat,
      lng: data.coord.lon,
      rainfallMm,
      description,
      humidity: data.main.humidity,
      raw: data,
      thresholdBreached: rainfallMm >= RAIN_THRESHOLD,
      triggerType: rainfallMm >= 100 ? "flood" : "rain",
      threshold: RAIN_THRESHOLD,
    };
  } catch (error) {
    logger.error(`WeatherService error: ${error.message}`);
    throw new Error(`OpenWeather API failed: ${error.message}`);
  }
};

/**
 * Fetch weather for coordinates (used for zone-level checks).
 */
const getWeatherByCoords = async (lat, lng) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/weather`, {
      params: { lat, lon: lng, appid: API_KEY, units: "metric" },
      timeout: 8000,
    });

    const rainfallMm = data.rain?.["1h"] || 0;
    return {
      rainfallMm,
      description: data.weather?.[0]?.description,
      thresholdBreached: rainfallMm >= RAIN_THRESHOLD,
    };
  } catch (error) {
    logger.error(`WeatherService (coords) error: ${error.message}`);
    return null;
  }
};

module.exports = { getCurrentWeather, getWeatherByCoords, RAIN_THRESHOLD };
