/**
 * Unit tests for the policyController functions.
 * Mongoose models are mocked — no real database is needed.
 */

jest.mock("../src/models/Plan");
jest.mock("../src/models/Policy");
jest.mock("../src/models/Claim");
jest.mock("../src/models/User");
jest.mock("../src/services/premiumService", () => ({
  calculateDynamicPremium: jest.fn().mockReturnValue({
    dynamicPremium: 47,
    discount: 2,
    discountReason: "No-claims bonus",
    zoneRiskFactor: 1.0,
    breakdown: {},
  }),
  estimateRiskScore: jest.fn().mockReturnValue(0.3),
}));
jest.mock("../src/services/razorpayService", () => ({
  createPremiumOrder: jest.fn().mockResolvedValue({ id: "order_test_123" }),
  verifyPaymentSignature: jest.fn().mockReturnValue(true),
}));
jest.mock("../src/services/mlDecisionService", () => ({
  getInsuranceDecision: jest.fn().mockResolvedValue({
    available: true,
    provider: "fastapi",
    modelVersion: "premium_model1B.pkl",
    decisionAt: new Date(),
    riskScore: 0.31,
    predictedPremium: 47,
    claimTriggered: true,
    triggerReasons: ["HEAVY_RAIN"],
    payload: {},
  }),
}));
jest.mock("../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const Plan = require("../src/models/Plan");
const Policy = require("../src/models/Policy");
const Claim = require("../src/models/Claim");
const User = require("../src/models/User");

// ─── Helpers ──────────────────────────────────────────────

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makePlanDoc = (overrides = {}) => ({
  _id: "plan_id_123",
  name: "smart",
  displayName: "Smart Shield",
  weeklyPremium: 49,
  coveragePerHour: 75,
  maxPayoutPerEvent: 300,
  maxPayoutPerWeek: 1200,
  maxHoursPerEvent: 4,
  triggerTypes: ["rain", "aqi"],
  isActive: true,
  ...overrides,
});

const makeUserDoc = (overrides = {}) => ({
  _id: "user_id_123",
  name: "Test Worker",
  location: { zone: "default" },
  weeklyAvgIncome: 5000,
  phoneVerified: true,
  kycVerified: true,
  kycScore: 0,
  computeKYCScore: jest.fn(),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const makePolicyDoc = (overrides = {}) => ({
  _id: "policy_id_123",
  userId: "user_id_123",
  planId: "plan_id_123",
  isActive: true,
  premiumPaid: true,
  totalPayoutThisPeriod: 0,
  claimsThisPeriod: 0,
  isValid: jest.fn().mockReturnValue(true),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const { getPlans, getQuote, subscribe, confirmPayment, getMyPolicies, cancelPolicy } =
  require("../src/controllers/policyController");

// ─── getPlans ────────────────────────────────────────────

describe("policyController.getPlans", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns all active plans sorted by weeklyPremium", async () => {
    const mockPlans = [makePlanDoc(), makePlanDoc({ name: "lite", weeklyPremium: 29, _id: "plan_id_456" })];
    Plan.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockPlans) });

    const req = {};
    const res = makeRes();
    const next = jest.fn();

    await getPlans(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, count: 2, data: { plans: mockPlans } })
    );
  });

  it("calls next(error) when database fails", async () => {
    Plan.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error("DB error")) });

    const req = {};
    const res = makeRes();
    const next = jest.fn();

    await getPlans(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── getQuote ────────────────────────────────────────────

describe("policyController.getQuote", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns a dynamic premium quote for a valid plan", async () => {
    Plan.findById.mockResolvedValue(makePlanDoc());
    Claim.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    Claim.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });

    const req = { params: { planId: "plan_id_123" }, user: makeUserDoc() };
    const res = makeRes();
    const next = jest.fn();

    await getQuote(req, res, next);

    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.quote).toHaveProperty("dynamicPremium", 47);
    expect(body.data.quote).toHaveProperty("mlDecision");
  });

  it("returns 404 when plan does not exist", async () => {
    Plan.findById.mockResolvedValue(null);

    const req = { params: { planId: "nonexistent" }, user: makeUserDoc() };
    const res = makeRes();
    const next = jest.fn();

    await getQuote(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });
});

// ─── subscribe ───────────────────────────────────────────

describe("policyController.subscribe", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 404 when plan is not found", async () => {
    User.findById.mockResolvedValue(makeUserDoc({ kycScore: 80 }));
    Plan.findById.mockResolvedValue(null);

    const req = { body: { planId: "nonexistent" }, user: makeUserDoc() };
    const res = makeRes();
    const next = jest.fn();

    await subscribe(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  it("returns 400 if user already has an active policy", async () => {
    User.findById.mockResolvedValue(makeUserDoc({ kycScore: 80 }));
    const planDoc = makePlanDoc();
    Plan.findById.mockResolvedValue(planDoc);

    const existingPolicy = makePolicyDoc();
    Policy.findOne.mockResolvedValue(existingPolicy);

    const req = { body: { planId: "plan_id_123" }, user: makeUserDoc() };
    const res = makeRes();
    const next = jest.fn();

    await subscribe(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/already have an active policy/i);
  });

  it("creates a policy and returns a Razorpay order when eligible", async () => {
    User.findById.mockResolvedValue(makeUserDoc({ kycScore: 80 }));
    const planDoc = makePlanDoc();
    Plan.findById.mockResolvedValue(planDoc);
    Policy.findOne.mockResolvedValue(null); // no existing active policy
    Claim.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    Claim.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });

    const createdPolicy = makePolicyDoc({ premiumPaid: false, mlDecision: { available: true } });
    Policy.create.mockResolvedValue(createdPolicy);

    process.env.RAZORPAY_KEY_ID = "rzp_test_123";

    const req = { body: { planId: "plan_id_123" }, user: makeUserDoc() };
    const res = makeRes();
    const next = jest.fn();

    await subscribe(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.payment.orderId).toBe("order_test_123");
    expect(body.data.policy).toHaveProperty("mlDecision");
  });

  it("returns 403 when KYC verification is pending", async () => {
    User.findById.mockResolvedValue(makeUserDoc({ phoneVerified: false, kycVerified: false, kycScore: 20 }));
    const req = { body: { planId: "plan_id_123" }, user: makeUserDoc({ phoneVerified: false, kycScore: 20 }) };
    const res = makeRes();
    const next = jest.fn();

    await subscribe(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe("KYC_VERIFICATION_PENDING");
  });
});

// ─── confirmPayment ──────────────────────────────────────

describe("policyController.confirmPayment", () => {
  afterEach(() => jest.clearAllMocks());

  it("activates the policy when payment signature is valid", async () => {
    const policyDoc = makePolicyDoc({ premiumPaid: false, razorpayPaymentId: null });
    Policy.findOne.mockResolvedValue(policyDoc);

    const req = {
      params: { policyId: "policy_id_123" },
      user: makeUserDoc(),
      body: {
        razorpayOrderId: "order_123",
        razorpayPaymentId: "pay_123",
        razorpaySignature: "sig_123",
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await confirmPayment(req, res, next);

    expect(policyDoc.premiumPaid).toBe(true);
    expect(policyDoc.save).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
  });

  it("returns 404 when policy is not found", async () => {
    Policy.findOne.mockResolvedValue(null);

    const req = {
      params: { policyId: "nonexistent" },
      user: makeUserDoc(),
      body: { razorpayOrderId: "o", razorpayPaymentId: "p", razorpaySignature: "s" },
    };
    const res = makeRes();
    const next = jest.fn();

    await confirmPayment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  it("returns 400 when payment signature is invalid", async () => {
    const { verifyPaymentSignature } = require("../src/services/razorpayService");
    verifyPaymentSignature.mockReturnValueOnce(false);

    Policy.findOne.mockResolvedValue(makePolicyDoc());

    const req = {
      params: { policyId: "policy_id_123" },
      user: makeUserDoc(),
      body: { razorpayOrderId: "o", razorpayPaymentId: "p", razorpaySignature: "bad_sig" },
    };
    const res = makeRes();
    const next = jest.fn();

    await confirmPayment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/verification failed/i);
  });
});

// ─── getMyPolicies ───────────────────────────────────────

describe("policyController.getMyPolicies", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns active policy and history", async () => {
    const activePolicy = makePolicyDoc();
    Policy.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([activePolicy]),
    });

    const req = { user: makeUserDoc() };
    const res = makeRes();
    const next = jest.fn();

    await getMyPolicies(req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.active).not.toBeNull();
    expect(body.data.totalPolicies).toBe(1);
  });

  it("returns null active when no valid policy exists", async () => {
    const expiredPolicy = makePolicyDoc({ isValid: jest.fn().mockReturnValue(false) });
    Policy.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([expiredPolicy]),
    });

    const req = { user: makeUserDoc() };
    const res = makeRes();
    const next = jest.fn();

    await getMyPolicies(req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.data.active).toBeNull();
    expect(body.data.history).toHaveLength(1);
  });
});

// ─── cancelPolicy ────────────────────────────────────────

describe("policyController.cancelPolicy", () => {
  afterEach(() => jest.clearAllMocks());

  it("cancels an active policy", async () => {
    const policyDoc = makePolicyDoc({ isActive: true, cancelledAt: null, cancelReason: null });
    Policy.findOne.mockResolvedValue(policyDoc);

    const req = {
      params: { policyId: "policy_id_123" },
      user: makeUserDoc(),
      body: { reason: "Not needed anymore" },
    };
    const res = makeRes();
    const next = jest.fn();

    await cancelPolicy(req, res, next);

    expect(policyDoc.isActive).toBe(false);
    expect(policyDoc.cancelReason).toBe("Not needed anymore");
    expect(policyDoc.save).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });

  it("returns 404 when no active policy is found", async () => {
    Policy.findOne.mockResolvedValue(null);

    const req = {
      params: { policyId: "nonexistent" },
      user: makeUserDoc(),
      body: {},
    };
    const res = makeRes();
    const next = jest.fn();

    await cancelPolicy(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });
});
