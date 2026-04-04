/**
 * InsurGo — AQI Service (OpenWeather Air Pollution API)
 * ───────────────────────────────────────────────────────
 * Uses the same OPENWEATHER_API_KEY — no extra signup needed.
 *
 * Endpoint: GET api.openweathermap.org/data/2.5/air_pollution
 * Free tier: yes, real-time data included.
 * Docs: https://openweathermap.org/api/air-pollution
 *
 * OpenWeather AQI scale (European):
 *   1 = Good | 2 = Fair | 3 = Moderate | 4 = Poor | 5 = Very Poor
 *
 * We also expose PM2.5 µg/m³ which maps to India's NAAQS standard:
 *   0–30   → Good
 *   31–60  → Satisfactory
 *   61–90  → Moderate
 *   91–120 → Poor
 *   121–250→ Very Poor
 *   >250   → Severe (Hazardous)
 *
 * Disruption trigger: OW AQI >= AQI_OW_THRESHOLD (default 4 = "Poor")
 * We also expose the PM2.5 value for richer UI display.
 */

const axios = require("axios");
const logger = require("../config/logger");

const BASE_URL = process.env.OPENWEATHER_BASE_URL; // https://api.openweathermap.org/data/2.5
const API_KEY  = process.env.OPENWEATHER_API_KEY;

// OpenWeather AQI threshold (1–5 scale). Default 4 = "Poor".
const AQI_OW_THRESHOLD = parseInt(process.env.AQI_OW_THRESHOLD) || 4;

// City coordinates for Mumbai and other supported cities
const CITY_COORDS = {
  mumbai:    { lat: 19.0760, lon: 72.8777 },
  delhi:     { lat: 28.6139, lon: 77.2090 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  chennai:   { lat: 13.0827, lon: 80.2707 },
  hyderabad: { lat: 17.3850, lon: 78.4867 },
  pune:      { lat: 18.5204, lon: 73.8567 },
  kolkata:   { lat: 22.5726, lon: 88.3639 },
};

/**
 * Fetch current Air Pollution data for a city.
 *
 * @param {string} city - city name (case-insensitive, e.g. "Mumbai" or "mumbai")
 * @returns {Object}    - parsed AQI data with threshold result
 */
const getCityAQI = async (city = "mumbai") => {
  try {
    const cityKey = city.toLowerCase();
    const coords  = CITY_COORDS[cityKey];

    if (!coords) {
      throw new Error(
        `City "${city}" not in AQI registry. Supported: ${Object.keys(CITY_COORDS).join(", ")}`
      );
    }

    const { data } = await axios.get(`${BASE_URL}/air_pollution`, {
      params: { lat: coords.lat, lon: coords.lon, appid: API_KEY },
      timeout: 8000,
    });

    const item       = data.list[0];
    const owAqi      = item.main.aqi;          // 1–5
    const components = item.components;        // µg/m³
    const pm25       = components.pm2_5 || 0;
    const pm10       = components.pm10  || 0;
    const no2        = components.no2   || 0;
    const o3         = components.o3    || 0;

    // Dominant pollutant (simple heuristic)
    const dominantPollutant = getDominantPollutant(components);

    return {
      city,
      aqiValue: owAqi,           // 1–5 OpenWeather scale
      aqiLabel: OW_AQI_LABELS[owAqi] || "Unknown",
      pm25,
      pm10,
      no2,
      o3,
      dominantPollutant,
      lat: coords.lat,
      lng: coords.lon,
      threshold: AQI_OW_THRESHOLD,
      thresholdBreached: owAqi >= AQI_OW_THRESHOLD,
      severity: getAQISeverity(owAqi),
      indiaPM25Category: getIndiaPM25Category(pm25),
      raw: data,
    };
  } catch (error) {
    logger.error(`AQIService (OpenWeather) error: ${error.message}`);
    throw new Error(`OpenWeather Air Pollution API failed: ${error.message}`);
  }
};

// ─── Helpers ──────────────────────────────────────────────

const OW_AQI_LABELS = {
  1: "Good",
  2: "Fair",
  3: "Moderate",
  4: "Poor",
  5: "Very Poor",
};

const getAQISeverity = (owAqi) => {
  if (owAqi <= 1) return "good";
  if (owAqi <= 2) return "fair";
  if (owAqi <= 3) return "moderate";
  if (owAqi <= 4) return "poor";
  return "very_poor";
};

// India NAAQS PM2.5 category (µg/m³, 24-hour average standard)
const getIndiaPM25Category = (pm25) => {
  if (pm25 <= 30)  return "Good";
  if (pm25 <= 60)  return "Satisfactory";
  if (pm25 <= 90)  return "Moderate";
  if (pm25 <= 120) return "Poor";
  if (pm25 <= 250) return "Very Poor";
  return "Severe";
};

const getDominantPollutant = (c) => {
  const ranked = [
    { name: "pm2_5", value: c.pm2_5 / 25   },  // WHO 24h guideline: 25 µg/m³
    { name: "pm10",  value: c.pm10  / 50   },
    { name: "no2",   value: c.no2   / 25   },
    { name: "o3",    value: c.o3    / 100  },
    { name: "so2",   value: c.so2   / 20   },
    { name: "co",    value: c.co    / 4000 },
  ];
  ranked.sort((a, b) => b.value - a.value);
  return ranked[0].name.replace("_", ".");
};

module.exports = { getCityAQI, getAQISeverity, AQI_OW_THRESHOLD };
