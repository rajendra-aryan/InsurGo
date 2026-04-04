const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  register,
  login,
  getMe,
  updateMe,
  heartbeat,
  sendPhoneOtp,
  verifyPhoneOtp,
} = require("../controllers/authController");

const otpRateLimit = rateLimit({
  windowMs: parseInt(process.env.AUTH_OTP_RATE_LIMIT_WINDOW_MS || "600000", 10),
  limit: parseInt(process.env.AUTH_OTP_RATE_LIMIT_MAX || "5", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many OTP attempts. Please retry shortly." },
});

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.post("/heartbeat", protect, heartbeat);
router.post("/phone-otp/send", otpRateLimit, protect, sendPhoneOtp);
router.post("/phone-otp/verify", otpRateLimit, protect, verifyPhoneOtp);

module.exports = router;
