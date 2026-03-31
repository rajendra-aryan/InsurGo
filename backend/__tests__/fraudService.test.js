const { evaluateFraud, getAction } = require("../src/services/fraudService");

// ─── Helpers ──────────────────────────────────────────────

const makeUser = (overrides = {}) => ({
  _id: "user123",
  name: "Test Worker",
  kycScore: 70,
  createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days old account
  ...overrides,
});

const makePolicy = (overrides = {}) => ({
  _id: "policy123",
  createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days old policy
  claimsThisPeriod: 0,
  ...overrides,
});

const makeEvent = (overrides = {}) => ({
  _id: "event123",
  type: "rain",
  city: "Mumbai",
  ...overrides,
});

// ─── getAction ────────────────────────────────────────────

describe("getAction", () => {
  it("returns auto_approve for score <= 20", () => {
    expect(getAction(0)).toBe("auto_approve");
    expect(getAction(20)).toBe("auto_approve");
  });

  it("returns manual_review for score 21–50", () => {
    expect(getAction(21)).toBe("manual_review");
    expect(getAction(50)).toBe("manual_review");
  });

  it("returns block_request_proof for score 51–75", () => {
    expect(getAction(51)).toBe("block_request_proof");
    expect(getAction(75)).toBe("block_request_proof");
  });

  it("returns reject_and_warn for score 76–99", () => {
    expect(getAction(76)).toBe("reject_and_warn");
    expect(getAction(99)).toBe("reject_and_warn");
  });

  it("returns lock_account for score 100", () => {
    expect(getAction(100)).toBe("lock_account");
  });
});

// ─── evaluateFraud ────────────────────────────────────────

describe("evaluateFraud", () => {
  it("auto-approves a clean claim (good GPS, strong KYC, old account)", () => {
    const user = makeUser({ kycScore: 80 });
    const policy = makePolicy({ createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) });
    const event = makeEvent();
    const gps = { lat: 19.0, lng: 72.8, speed: 20 };

    const result = evaluateFraud(user, policy, event, gps, []);

    expect(result.fraudScore).toBeLessThanOrEqual(20);
    expect(result.action).toBe("auto_approve");
    expect(result.autoApprove).toBe(true);
    expect(result.fraudFlags).toHaveLength(0);
  });

  it("flags GPS_ANOMALY for impossible speed", () => {
    const user = makeUser({ kycScore: 80 });
    const policy = makePolicy({ createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) });
    const event = makeEvent();
    const gps = { lat: 19.0, lng: 72.8, speed: 200 }; // impossibly fast

    const result = evaluateFraud(user, policy, event, gps, []);

    expect(result.fraudFlags).toContain("GPS_ANOMALY");
  });

  it("flags FRESH_ACCOUNT for accounts < 7 days old", () => {
    const user = makeUser({
      kycScore: 70,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days old
    });
    const policy = makePolicy({ createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    const event = makeEvent();
    const gps = { lat: 19.0, lng: 72.8, speed: 25 };

    const result = evaluateFraud(user, policy, event, gps, []);

    expect(result.fraudFlags).toContain("FRESH_ACCOUNT");
  });

  it("flags KYC_WEAKNESS for very low KYC score", () => {
    const user = makeUser({ kycScore: 0 });
    const policy = makePolicy({ createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
    const event = makeEvent();
    const gps = { lat: 19.0, lng: 72.8, speed: 20 };

    const result = evaluateFraud(user, policy, event, gps, []);

    expect(result.fraudFlags).toContain("KYC_WEAKNESS");
  });

  it("flags BEHAVIORAL_OUTLIER for duplicate claim on same event", () => {
    const user = makeUser({ kycScore: 70 });
    const policy = makePolicy({ createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
    const event = makeEvent({ _id: "event_dup" });
    const gps = { lat: 19.0, lng: 72.8, speed: 20 };

    // One recent claim already exists for the same event
    const recentClaims = [
      { eventId: "event_dup", payoutAmount: 150, createdAt: new Date() },
    ];

    const result = evaluateFraud(user, policy, event, gps, recentClaims);

    expect(result.fraudFlags).toContain("BEHAVIORAL_OUTLIER");
  });

  it("flags SUSPICIOUS_CLAIM_PATTERN when claiming on policy day 1 with high claim count", () => {
    const user = makeUser({ kycScore: 70 });
    // Policy created today AND 5 claims this period → policyScore = 60 + 30 = 90 > 60
    const policy = makePolicy({ createdAt: new Date(), claimsThisPeriod: 5 });
    const event = makeEvent();
    const gps = { lat: 19.0, lng: 72.8, speed: 20 };

    const result = evaluateFraud(user, policy, event, gps, []);

    expect(result.fraudFlags).toContain("SUSPICIOUS_CLAIM_PATTERN");
  });

  it("handles missing gpsSnapshot gracefully (no GPS = moderate risk)", () => {
    const user = makeUser({ kycScore: 80 });
    const policy = makePolicy({ createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) });
    const event = makeEvent();

    const result = evaluateFraud(user, policy, event, null, []);

    // GPS missing adds 40 * 0.25 = 10 to score — still possible to auto-approve with good KYC
    expect(result).toHaveProperty("fraudScore");
    expect(result.details.gps).toMatch(/No GPS/);
  });

  it("caps fraud score at 100", () => {
    // Worst case: brand new account, fresh policy, duplicate claim, bad GPS
    const user = makeUser({
      kycScore: 0,
      createdAt: new Date(), // brand new
    });
    const policy = makePolicy({ createdAt: new Date(), claimsThisPeriod: 10 });
    const event = makeEvent({ _id: "event_dup" });
    const gps = { lat: 19.0, lng: 72.8, speed: 200 }; // impossible speed

    const recentClaims = [
      { eventId: "event_dup", payoutAmount: 150, createdAt: new Date() },
      { eventId: "event_dup", payoutAmount: 150, createdAt: new Date() },
      { eventId: "event_dup", payoutAmount: 150, createdAt: new Date() },
    ];

    const result = evaluateFraud(user, policy, event, gps, recentClaims);

    expect(result.fraudScore).toBeLessThanOrEqual(100);
  });

  it("does not flag high-frequency claims for < 3 recent claims", () => {
    const user = makeUser({ kycScore: 70 });
    const policy = makePolicy({ createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
    const event = makeEvent({ _id: "event_other" });
    const gps = { lat: 19.0, lng: 72.8, speed: 20 };

    const recentClaims = [
      { eventId: "event_1", payoutAmount: 150, createdAt: new Date() },
      { eventId: "event_2", payoutAmount: 200, createdAt: new Date() },
    ];

    const result = evaluateFraud(user, policy, event, gps, recentClaims);

    // Should NOT flag behavioral outlier just for 2 claims
    expect(result.details.behavior).not.toMatch(/suspicious/i);
  });
});
