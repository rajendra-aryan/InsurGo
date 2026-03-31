const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getActiveEvents, getEvents, getEventById, liveCheck, triggerManual, resolveEvent,
} = require("../controllers/eventController");

router.get("/active", getActiveEvents);                    // public — show live disruptions
router.get("/live-check", liveCheck);                     // public — poll APIs now
router.get("/", protect, getEvents);
router.get("/:eventId", protect, getEventById);
router.post("/manual-trigger", protect, triggerManual);   // admin: fire test event
router.patch("/:eventId/resolve", protect, resolveEvent); // admin: close event

module.exports = router;
