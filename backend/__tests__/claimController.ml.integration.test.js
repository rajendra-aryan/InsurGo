jest.mock("../src/models/Claim");
jest.mock("../src/models/Policy");
jest.mock("../src/models/Event");
jest.mock("../src/models/User");
jest.mock("../src/services/fraudService", () => ({
  evaluateFraud: jest.fn().mockReturnValue({
    fraudScore: 10,
    fraudFlags: [],
    details: {},
    action: "auto_approve",
  }),
}));
jest.mock("../src/services/premiumService", () => ({
  calculatePayout: jest.fn().mockReturnValue({
    eligibleHours: 2,
    coveragePerHour: 100,
    grossPayout: 200,
    payoutAmount: 200,
    cappedBy: null,
  }),
}));
jest.mock("../src/services/triggerService", () => ({
  processPayout: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../src/services/mlDecisionService", () => ({
  getInsuranceDecision: jest.fn().mockResolvedValue({
    available: true,
    provider: "fastapi",
    modelVersion: "premium_model1B.pkl",
    decisionAt: new Date(),
    riskScore: 0.72,
    predictedPremium: 41,
    claimTriggered: true,
    triggerReasons: ["HEAVY_RAIN"],
    payload: { rainfall_mm: 65 },
  }),
}));
jest.mock("../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const Claim = require("../src/models/Claim");
const Policy = require("../src/models/Policy");
const Event = require("../src/models/Event");
const { submitManualClaim } = require("../src/controllers/claimController");

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("claimController ML integration path", () => {
  afterEach(() => jest.clearAllMocks());

  it("writes mlDecision to claim and returns mlDecision in API response", async () => {
    const user = {
      _id: "user_123",
      name: "Worker",
      isBlocked: false,
      lastActiveAt: new Date(),
    };
    const event = {
      _id: "event_123",
      isActive: true,
      durationHours: 2,
      rawData: { rainfallMm: 65 },
    };
    const policy = {
      _id: "policy_123",
      userId: user._id,
      isActive: true,
      premiumPaid: true,
      totalPayoutThisPeriod: 0,
      isValid: () => true,
    };

    Event.findById.mockResolvedValue(event);
    Policy.findOne.mockResolvedValue(policy);
    Claim.findOne.mockResolvedValue(null);
    Claim.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      }),
    });
    Claim.create.mockResolvedValue({ _id: "claim_123" });
    Claim.findById.mockResolvedValue({
      _id: "claim_123",
      mlDecision: { available: true, triggerReasons: ["HEAVY_RAIN"] },
    });

    const req = { user, body: { eventId: "event_123", gpsSnapshot: { lat: 1, lng: 2 } } };
    const res = makeRes();
    const next = jest.fn();

    await submitManualClaim(req, res, next);

    expect(Claim.create).toHaveBeenCalledWith(expect.objectContaining({
      mlDecision: expect.objectContaining({
        available: true,
        modelVersion: "premium_model1B.pkl",
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.mlDecision).toEqual(expect.objectContaining({
      available: true,
      modelVersion: "premium_model1B.pkl",
    }));
  });
});
