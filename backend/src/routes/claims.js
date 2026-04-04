const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getMyClaims, getClaimById, submitManualClaim, getMyClaimStats, reviewClaim,
} = require("../controllers/claimController");

const claimsRateLimit = rateLimit({
  windowMs: parseInt(process.env.CLAIMS_RATE_LIMIT_WINDOW_MS || "60000", 10),
  limit: parseInt(process.env.CLAIMS_RATE_LIMIT_MAX || "30", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many claim requests. Please retry shortly." },
});

router.get("/my", claimsRateLimit, protect, getMyClaims);
router.get("/stats", claimsRateLimit, protect, getMyClaimStats);
router.post("/manual", claimsRateLimit, protect, submitManualClaim);
router.get("/:claimId", claimsRateLimit, protect, getClaimById);
router.patch("/:claimId/review", claimsRateLimit, protect, reviewClaim); // admin only in prod

module.exports = router;
