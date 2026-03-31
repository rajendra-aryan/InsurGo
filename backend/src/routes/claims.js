const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getMyClaims, getClaimById, submitManualClaim, getMyClaimStats, reviewClaim,
} = require("../controllers/claimController");

router.get("/my", protect, getMyClaims);
router.get("/stats", protect, getMyClaimStats);
router.post("/manual", protect, submitManualClaim);
router.get("/:claimId", protect, getClaimById);
router.patch("/:claimId/review", protect, reviewClaim); // admin only in prod

module.exports = router;
