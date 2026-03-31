const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getPlans, getQuote, subscribe, confirmPayment, getMyPolicies, cancelPolicy,
} = require("../controllers/policyController");

router.get("/plans", getPlans);                               // public
router.get("/plans/:planId/quote", protect, getQuote);        // personalised quote
router.post("/subscribe", protect, subscribe);                // start subscription
router.post("/:policyId/confirm-payment", protect, confirmPayment); // activate after payment
router.get("/my", protect, getMyPolicies);                    // my policies
router.delete("/:policyId/cancel", protect, cancelPolicy);   // cancel

module.exports = router;
