const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { calculate, getZoneRiskMap, getMyRiskProfile, getMlStatus } = require("../controllers/premiumController");

router.post("/calculate", calculate);                       // public — quote preview
router.get("/zone-risk", getZoneRiskMap);                  // public — zone risk data
router.get("/my-risk-profile", protect, getMyRiskProfile); // personalized risk profile
router.get("/ml-status", getMlStatus);                     // service health for ML pipeline

module.exports = router;
