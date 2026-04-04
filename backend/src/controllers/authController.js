const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { estimateRiskScore } = require("../services/premiumService");
const logger = require("../config/logger");
const { KYC_MINIMUM_SCORE_TO_SUBSCRIBE } = require("../constants/kyc");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

/**
 * POST /api/auth/register
 * Onboard a new delivery worker
 */
const register = async (req, res, next) => {
  try {
    const {
      name, phone, email, password,
      deliveryPlatform, platformWorkerId,
      avgHourlyIncome, weeklyAvgIncome,
      location,
      governmentIdType, governmentIdNumber,
      bankAccount, deviceInfo,
    } = req.body;

    // Check phone uniqueness
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ success: false, message: "Phone number already registered" });
    }

    // Compute account age (0 for new)
    const user = new User({
      name, phone, email, password,
      deliveryPlatform, platformWorkerId,
      avgHourlyIncome: avgHourlyIncome || 100,
      weeklyAvgIncome: weeklyAvgIncome || 5000,
      location: location || {},
      governmentIdType, governmentIdNumber,
      bankAccount: bankAccount || {},
      deviceInfo: deviceInfo || {},
      accountAge: 0,
      lastActiveAt: new Date(),
    });

    const phoneOtp = user.issuePhoneOtp();

    // Compute KYC score
    user.computeKYCScore();

    // Platform verification (in production: call platform API)
    if (platformWorkerId && deliveryPlatform) {
      user.platformVerified = true; // Simulate platform check
      user.kycScore = Math.min(100, user.kycScore + 10);
    }

    await user.save();

    const token = signToken(user._id);

    logger.info(`New worker registered: ${user.name} (${user.phone})`);

    res.status(201).json({
      success: true,
      message: "Registration successful. Verify your phone to complete KYC and buy plans.",
      token,
      data: {
        user,
        phoneVerification: {
          required: true,
          otpSent: true,
          expiresAt: user.phoneOtpExpiresAt,
          ...(process.env.NODE_ENV !== "production" ? { devOtp: phoneOtp } : {}),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "Phone and password required" });
    }

    const user = await User.findOne({ phone }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid phone or password" });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: `Account blocked: ${user.blockReason}`,
      });
    }

    // Update last active
    user.lastActiveAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get current logged-in worker's profile
 */
const getMe = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

/**
 * PATCH /api/auth/me
 * Update profile — location, bank account, etc.
 */
const updateMe = async (req, res, next) => {
  try {
    const allowed = [
      "name", "email", "location", "avgHourlyIncome",
      "weeklyAvgIncome", "bankAccount", "deviceInfo",
      "governmentIdType", "governmentIdNumber",
    ];

    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    // Recompute KYC score after profile update
    user.computeKYCScore();
    user.kycVerified = user.phoneVerified && user.kycScore >= KYC_MINIMUM_SCORE_TO_SUBSCRIBE;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/auth/heartbeat
 * Worker app pings this every few minutes to signal they're active.
 * Used for eligibility check in trigger pipeline.
 */
const heartbeat = async (req, res, next) => {
  try {
    const { lat, lng, speed } = req.body;

    const update = { lastActiveAt: new Date() };
    if (lat && lng) {
      update["location.lat"] = lat;
      update["location.lng"] = lng;
    }

    await User.findByIdAndUpdate(req.user._id, update);

    res.json({ success: true, message: "Heartbeat received", timestamp: new Date() });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/phone-otp/send
 * Issue OTP to verify user phone (simulated delivery for now).
 */
const sendPhoneOtp = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const otp = user.issuePhoneOtp();
    await user.save({ validateBeforeSave: false });

    logger.info(`Phone OTP issued for user ${user._id}`);

    const response = {
      success: true,
      message: "OTP sent successfully to your phone.",
      data: {
        otpSent: true,
        expiresAt: user.phoneOtpExpiresAt,
      },
    };

    if (process.env.NODE_ENV !== "production") {
      response.data.devOtp = otp;
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/phone-otp/verify
 * Verify OTP and mark phone/KYC status.
 */
const verifyPhoneOtp = async (req, res, next) => {
  try {
    const { otp } = req.body || {};
    if (!otp) return res.status(400).json({ success: false, message: "OTP is required" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const isValid = user.verifyPhoneOtp(otp);
    if (!isValid) {
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP. Please request a new OTP.",
      });
    }

    user.computeKYCScore();
    user.kycVerified = user.phoneVerified && user.kycScore >= KYC_MINIMUM_SCORE_TO_SUBSCRIBE;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: "Phone verification complete. KYC updated.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, updateMe, heartbeat, sendPhoneOtp, verifyPhoneOtp };
