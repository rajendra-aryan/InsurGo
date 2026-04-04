const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getPlans, getQuote, subscribe, confirmPayment, getMyPolicies, cancelPolicy,
} = require("../controllers/policyController");

const subscribeRateLimit = rateLimit({
  windowMs: parseInt(process.env.POLICY_SUBSCRIBE_RATE_LIMIT_WINDOW_MS || "60000", 10),
  limit: parseInt(process.env.POLICY_SUBSCRIBE_RATE_LIMIT_MAX || "10", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many subscribe attempts. Please retry shortly." },
});

router.get("/plans", getPlans);                               // public
router.get("/plans/:planId/quote", protect, getQuote);        // personalised quote
router.post("/subscribe", subscribeRateLimit, protect, subscribe);                // start subscription
router.post("/:policyId/confirm-payment", protect, confirmPayment); // activate after payment
router.get("/my", protect, getMyPolicies);                    // my policies
router.delete("/:policyId/cancel", protect, cancelPolicy);   // cancel

module.exports = router;
