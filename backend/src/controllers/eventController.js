const Event = require("../models/Event");
const { getCurrentWeather } = require("../services/weatherService");
const { getCityAQI } = require("../services/aqiService");
const { manualTrigger } = require("../services/triggerService");
const logger = require("../config/logger");

/**
 * GET /api/events/active
 * Get all currently active disruption events
 */
const getActiveEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ isActive: true }).sort({ detectedAt: -1 });
    res.json({ success: true, count: events.length, data: { events } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events
 * Get event history with optional filters
 */
const getEvents = async (req, res, next) => {
  try {
    const { type, city, limit = 20, page = 1 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (city) filter.city = city;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(filter).sort({ detectedAt: -1 }).limit(parseInt(limit)).skip(skip),
      Event.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        events,
        pagination: { total, page: parseInt(page), limit: parseInt(limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/:eventId
 */
const getEventById = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    res.json({ success: true, data: { event } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/events/live-check
 * Poll real APIs right now and return status — useful for frontend dashboard
 */
const liveCheck = async (req, res, next) => {
  try {
    const city = req.query.city || "Mumbai";
    const results = { city, timestamp: new Date(), checks: {} };

    // Weather check
    try {
      const weather = await getCurrentWeather(city);
      results.checks.rain = {
        value: weather.rainfallMm,
        threshold: weather.threshold,
        breached: weather.thresholdBreached,
        description: weather.description,
        status: weather.thresholdBreached ? "🚨 DISRUPTION ACTIVE" : "✅ Normal",
      };
    } catch (e) {
      results.checks.rain = { error: e.message };
    }

    // AQI check
    try {
      const aqi = await getCityAQI(city.toLowerCase());
      results.checks.aqi = {
        value: aqi.aqiValue,
        threshold: aqi.threshold,
        breached: aqi.thresholdBreached,
        severity: aqi.severity,
        pollutant: aqi.dominantPollutant,
        status: aqi.thresholdBreached ? "🚨 DISRUPTION ACTIVE" : "✅ Normal",
      };
    } catch (e) {
      results.checks.aqi = { error: e.message };
    }

    // Curfew — manual flag from env
    results.checks.curfew = {
      active: process.env.CURFEW_TRIGGER_ENABLED === "true",
      status:
        process.env.CURFEW_TRIGGER_ENABLED === "true"
          ? "🚨 CURFEW ACTIVE"
          : "✅ No curfew",
    };

    const anyDisruption = Object.values(results.checks).some((c) => c.breached || c.active);
    results.overallStatus = anyDisruption ? "DISRUPTION_DETECTED" : "ALL_CLEAR";

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/events/manual-trigger  (Admin)
 * Manually fire a disruption event for testing / demo
 */
const triggerManual = async (req, res, next) => {
  try {
    const { type, city, triggerValue, adminNote } = req.body;

    const validTypes = ["rain", "flood", "aqi", "curfew"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${validTypes.join(", ")}`,
      });
    }

    logger.info(`Manual trigger fired by admin: type=${type}, city=${city}`);
    await manualTrigger({ type, city, triggerValue, adminNote });

    res.json({
      success: true,
      message: `✅ Manual trigger for ${type} in ${city || "Mumbai"} fired. Claims pipeline running.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/events/:eventId/resolve  (Admin)
 * Mark an event as resolved — stops new claims from being created for it
 */
const resolveEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });

    const resolvedAt = new Date();
    const durationHours = parseFloat(
      ((resolvedAt - new Date(event.detectedAt)) / (1000 * 60 * 60)).toFixed(2)
    );

    event.isActive = false;
    event.resolvedAt = resolvedAt;
    event.durationHours = durationHours;
    await event.save();

    res.json({
      success: true,
      message: `Event resolved. Duration: ${durationHours}h`,
      data: { event },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getActiveEvents, getEvents, getEventById, liveCheck, triggerManual, resolveEvent };
