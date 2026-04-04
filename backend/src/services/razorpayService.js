/**
 * InsurGo × Razorpay Payout Integration
 * ──────────────────────────────────────
 * Uses Razorpay Payouts API (X API) to transfer money to worker bank accounts.
 * Sandbox credentials from your Razorpay dashboard → Settings → API Keys (Test Mode)
 *
 * Razorpay Payout API Docs: https://razorpay.com/docs/api/x/payouts/
 */

const Razorpay = require("razorpay");
const axios = require("axios");
const logger = require("../config/logger");

const getMissingEnvVars = (keys = []) =>
  keys.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");

const assertEnvVars = (keys = []) => {
  const missing = getMissingEnvVars(keys);
  if (missing.length) {
    throw new Error(`Missing Razorpay configuration: ${missing.join(", ")}`);
  }
};

const extractErrorMessage = (error, fallback = "Unknown Razorpay error") => {
  return (
    error?.response?.data?.description ||
    error?.response?.data?.error?.description ||
    error?.response?.data?.message ||
    error?.error?.description ||
    error?.message ||
    fallback
  );
};

// Lazy-initialize so the module can be required before .env is loaded
let _razorpay = null;
const getRazorpay = () => {
  assertEnvVars(["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]);
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
};

// Base64 auth for Payout API (uses key:secret)
const getAuthHeader = () => {
  assertEnvVars(["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]);
  const creds = `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
};

const RAZORPAY_PAYOUT_URL = "https://api.razorpay.com/v1";
const RECEIPT_MAX_LENGTH = 40;
const RECEIPT_PREFIX = "premium_";

const buildPremiumReceipt = (policyId) => {
  const rawReference = String(policyId || "").trim();
  const safeReference = rawReference.replace(/[^a-zA-Z0-9_-]/g, "");
  const fallbackReference = "policy";
  const source = safeReference || fallbackReference;
  const head = source.slice(0, 12);
  const tail = source.length > 12 ? source.slice(-16) : "";
  const compactReference = tail && tail !== head ? `${head}_${tail}` : head;
  return `${RECEIPT_PREFIX}${compactReference}`.slice(0, RECEIPT_MAX_LENGTH);
};

/**
 * Create a Fund Account for a worker (needed before initiating payout).
 * Each worker needs a Fund Account ID tied to their bank account.
 *
 * @param {Object} user - User document with bankAccount details
 * @returns {string} fundAccountId
 */
const createFundAccount = async (user) => {
  try {
    const payload = {
      contact_id: await getOrCreateContact(user),
      account_type: "bank_account",
      bank_account: {
        name: user.bankAccount.accountHolderName || user.name,
        ifsc: user.bankAccount.ifsc,
        account_number: user.bankAccount.accountNumber,
      },
    };

    const { data } = await axios.post(
      `${RAZORPAY_PAYOUT_URL}/fund_accounts`,
      payload,
      { headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" } }
    );

    logger.info(`Fund account created: ${data.id} for user ${user._id}`);
    return data.id;
  } catch (error) {
    logger.error(`createFundAccount error: ${error.response?.data?.description || error.message}`);
    throw new Error(`Failed to create fund account: ${error.message}`);
  }
};

/**
 * Get or create a Razorpay Contact for the worker.
 */
const getOrCreateContact = async (user) => {
  try {
    const payload = {
      name: user.name,
      contact: user.phone,
      type: "employee",
      reference_id: user._id.toString(),
      notes: { platform: user.deliveryPlatform || "gig_worker" },
    };

    const { data } = await axios.post(
      `${RAZORPAY_PAYOUT_URL}/contacts`,
      payload,
      { headers: { Authorization: getAuthHeader(), "Content-Type": "application/json" } }
    );

    return data.id;
  } catch (error) {
    logger.error(`getOrCreateContact error: ${error.message}`);
    throw new Error(`Failed to create Razorpay contact: ${error.message}`);
  }
};

/**
 * Initiate a payout to a worker's bank account.
 *
 * @param {Object} params
 * @param {string} params.fundAccountId  - Razorpay fund account ID
 * @param {number} params.amountInPaise  - Amount in paise (₹1 = 100 paise)
 * @param {string} params.claimId        - Our internal claim ID (for narration)
 * @param {string} params.workerName     - Worker name
 * @returns {Object} Razorpay payout response
 */
const initiatePayout = async ({ fundAccountId, amountInPaise, claimId, workerName }) => {
  try {
    assertEnvVars(["RAZORPAY_ACCOUNT_NUMBER"]);
    const payload = {
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
      fund_account_id: fundAccountId,
      amount: amountInPaise,
      currency: "INR",
      mode: "IMPS",
      purpose: "payout",
      queue_if_low_balance: true,
      narration: `InsurGo Claim ${claimId}`,
      notes: {
        claim_id: claimId,
        worker: workerName,
        source: "InsurGo Auto-Payout",
      },
    };

    const { data } = await axios.post(
      `${RAZORPAY_PAYOUT_URL}/payouts`,
      payload,
      {
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
          "X-Payout-Idempotency": claimId, // prevent duplicate payouts
        },
      }
    );

    logger.info(
      `Payout initiated: ${data.id} | ₹${amountInPaise / 100} → ${workerName} | Status: ${data.status}`
    );

    return {
      razorpayPayoutId: data.id,
      status: data.status,
      utr: data.utr,
      mode: data.mode,
    };
  } catch (error) {
    const errMsg = extractErrorMessage(error, "Unknown payout error");
    logger.error(`initiatePayout error: ${errMsg}`);
    throw new Error(`Payout failed: ${errMsg}`);
  }
};

/**
 * Check the status of an existing payout.
 * Razorpay statuses: queued | pending | processing | processed | cancelled | reversed | failed
 */
const getPayoutStatus = async (payoutId) => {
  try {
    const { data } = await axios.get(`${RAZORPAY_PAYOUT_URL}/payouts/${payoutId}`, {
      headers: { Authorization: getAuthHeader() },
    });
    return { status: data.status, utr: data.utr, failureReason: data.failure_reason };
  } catch (error) {
    logger.error(`getPayoutStatus error: ${error.message}`);
    throw new Error(`Could not fetch payout status: ${error.message}`);
  }
};

/**
 * Create a Razorpay Order for collecting a premium payment from a worker.
 * @param {number} amountInPaise - Premium amount in paise
 * @param {string} policyId - Policy ID (for reference)
 */
const createPremiumOrder = async (amountInPaise, policyId) => {
  try {
    const order = await getRazorpay().orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: buildPremiumReceipt(policyId),
      notes: { policy_id: policyId, type: "weekly_premium" },
    });
    return order;
  } catch (error) {
    const errMsg = extractErrorMessage(error, "Unknown Razorpay order creation error");
    logger.error(`createPremiumOrder error: ${errMsg}`);
    throw new Error(`Failed to create payment order: ${errMsg}`);
  }
};

/**
 * Verify Razorpay payment signature after premium collection.
 */
const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  assertEnvVars(["RAZORPAY_KEY_SECRET"]);
  const body = `${orderId}|${paymentId}`;
  const expectedSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return expectedSig === signature;
};

module.exports = {
  createFundAccount,
  initiatePayout,
  getPayoutStatus,
  createPremiumOrder,
  verifyPaymentSignature,
};
