/**
 * Unit tests for the authController functions.
 * Mongoose models are mocked — no real database is needed.
 */

const jwt = require("jsonwebtoken");

// ─── Mock dependencies ────────────────────────────────────

jest.mock("../src/models/User");
jest.mock("../src/services/premiumService", () => ({
  estimateRiskScore: jest.fn().mockReturnValue(0.3),
}));
jest.mock("../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const User = require("../src/models/User");

// ─── Environment ──────────────────────────────────────────

process.env.JWT_SECRET = "test_secret";
process.env.JWT_EXPIRES_IN = "7d";

// ─── Helpers ──────────────────────────────────────────────

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeUserDoc = (overrides = {}) => ({
  _id: "user_id_123",
  name: "Test Worker",
  phone: "9876543210",
  email: null,
  kycScore: 0,
  isBlocked: false,
  blockReason: null,
  computeKYCScore: jest.fn().mockReturnValue(0),
  save: jest.fn().mockResolvedValue(true),
  toJSON: jest.fn().mockReturnThis(),
  lastActiveAt: null,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────

const { register, login, getMe, updateMe, heartbeat } = require("../src/controllers/authController");

describe("authController.register", () => {
  afterEach(() => jest.clearAllMocks());

  it("creates a new user and returns a token", async () => {
    const userDoc = makeUserDoc();
    User.findOne.mockResolvedValue(null); // no existing user
    User.mockImplementation(() => userDoc);

    const req = {
      body: {
        name: "Test Worker",
        phone: "9876543210",
        password: "password123",
        deliveryPlatform: "zomato",
        location: { city: "Mumbai" },
        avgHourlyIncome: 100,
        weeklyAvgIncome: 5000,
      },
    };
    const res = makeRes();
    const next = jest.fn();

    await register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.data.user).toBeDefined();
  });

  it("rejects registration if phone is already registered", async () => {
    User.findOne.mockResolvedValue(makeUserDoc()); // phone exists

    const req = { body: { phone: "9876543210", password: "password123", name: "X" } };
    const res = makeRes();
    const next = jest.fn();

    await register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/already registered/i);
  });

  it("calls next(error) on unexpected database error", async () => {
    User.findOne.mockRejectedValue(new Error("DB connection lost"));

    const req = { body: { phone: "9876543210", password: "secret", name: "X" } };
    const res = makeRes();
    const next = jest.fn();

    await register(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("authController.login", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns a token for correct credentials", async () => {
    const userDoc = makeUserDoc({ comparePassword: jest.fn().mockResolvedValue(true) });
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(userDoc) });

    const req = { body: { phone: "9876543210", password: "password123" } };
    const res = makeRes();
    const next = jest.fn();

    await login(req, res, next);

    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
  });

  it("rejects incorrect password (401)", async () => {
    const userDoc = makeUserDoc({ comparePassword: jest.fn().mockResolvedValue(false) });
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(userDoc) });

    const req = { body: { phone: "9876543210", password: "wrongpassword" } };
    const res = makeRes();
    const next = jest.fn();

    await login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  it("rejects unknown phone number (401)", async () => {
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    const req = { body: { phone: "0000000000", password: "password123" } };
    const res = makeRes();
    const next = jest.fn();

    await login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when phone is missing", async () => {
    const req = { body: { password: "password123" } };
    const res = makeRes();
    const next = jest.fn();

    await login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  it("returns 400 when password is missing", async () => {
    const req = { body: { phone: "9876543210" } };
    const res = makeRes();
    const next = jest.fn();

    await login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects blocked users (403)", async () => {
    const userDoc = makeUserDoc({
      isBlocked: true,
      blockReason: "Fraud detected",
      comparePassword: jest.fn().mockResolvedValue(true),
    });
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(userDoc) });

    const req = { body: { phone: "9876543210", password: "password123" } };
    const res = makeRes();
    const next = jest.fn();

    await login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].message).toMatch(/blocked/i);
  });
});

describe("authController.getMe", () => {
  it("returns the authenticated user", async () => {
    const userDoc = makeUserDoc();
    const req = { user: userDoc };
    const res = makeRes();

    await getMe(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { user: userDoc } });
  });
});

describe("authController.updateMe", () => {
  afterEach(() => jest.clearAllMocks());

  it("updates allowed fields and recomputes KYC score", async () => {
    const userDoc = makeUserDoc();
    User.findByIdAndUpdate.mockResolvedValue(userDoc);

    const req = {
      user: userDoc,
      body: { name: "New Name", location: { city: "Delhi" } },
    };
    const res = makeRes();
    const next = jest.fn();

    await updateMe(req, res, next);

    expect(User.findByIdAndUpdate).toHaveBeenCalled();
    expect(userDoc.computeKYCScore).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it("ignores disallowed fields (e.g. phone)", async () => {
    const userDoc = makeUserDoc();
    User.findByIdAndUpdate.mockResolvedValue(userDoc);

    const req = {
      user: userDoc,
      body: { phone: "0000000000", name: "New Name" }, // phone should be ignored
    };
    const res = makeRes();
    const next = jest.fn();

    await updateMe(req, res, next);

    // Check that findByIdAndUpdate was NOT called with phone
    const updateArg = User.findByIdAndUpdate.mock.calls[0][1];
    expect(updateArg.phone).toBeUndefined();
    expect(updateArg.name).toBe("New Name");
  });

  it("calls next(error) on database failure", async () => {
    User.findByIdAndUpdate.mockRejectedValue(new Error("DB error"));

    const req = { user: makeUserDoc(), body: { name: "Test" } };
    const res = makeRes();
    const next = jest.fn();

    await updateMe(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("authController.heartbeat", () => {
  afterEach(() => jest.clearAllMocks());

  it("updates lastActiveAt and returns success", async () => {
    User.findByIdAndUpdate.mockResolvedValue({});

    const req = { user: makeUserDoc(), body: { lat: 19.0, lng: 72.8 } };
    const res = makeRes();
    const next = jest.fn();

    await heartbeat(req, res, next);

    expect(User.findByIdAndUpdate).toHaveBeenCalled();
    const updateArg = User.findByIdAndUpdate.mock.calls[0][1];
    expect(updateArg.lastActiveAt).toBeDefined();
    expect(updateArg["location.lat"]).toBe(19.0);
    expect(updateArg["location.lng"]).toBe(72.8);
    expect(res.json.mock.calls[0][0].success).toBe(true);
  });

  it("updates lastActiveAt without location when no GPS is provided", async () => {
    User.findByIdAndUpdate.mockResolvedValue({});

    const req = { user: makeUserDoc(), body: {} };
    const res = makeRes();
    const next = jest.fn();

    await heartbeat(req, res, next);

    const updateArg = User.findByIdAndUpdate.mock.calls[0][1];
    expect(updateArg["location.lat"]).toBeUndefined();
  });
});
