const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { calculate, getZoneRiskMap, getMyRiskProfile } = require("../controllers/premiumController");

router.post("/calculate", calculate);                       // public — quote preview
router.get("/zone-risk", getZoneRiskMap);                  // public — zone risk data
router.get("/my-risk-profile", protect, getMyRiskProfile); // personalized risk profile

module.exports = router;
