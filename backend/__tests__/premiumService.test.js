const {
  calculateDynamicPremium,
  calculatePayout,
  estimateRiskScore,
  ZONE_RISK_REGISTRY,
} = require("../src/services/premiumService");

// ─── Helpers ──────────────────────────────────────────────

const makePlan = (overrides = {}) => ({
  weeklyPremium: 49,
  coveragePerHour: 75,
  maxPayoutPerEvent: 300,
  maxPayoutPerWeek: 1200,
  maxHoursPerEvent: 4,
  ...overrides,
});

const makeWorker = (overrides = {}) => ({
  name: "Test Worker",
  location: { zone: "default", city: "Mumbai" },
  weeklyAvgIncome: 5000,
  kycScore: 0,
  ...overrides,
});

// ─── calculateDynamicPremium ──────────────────────────────

describe("calculateDynamicPremium", () => {
  it("returns basePremium for a default/neutral worker with no claims", () => {
    const plan = makePlan({ weeklyPremium: 100 });
    const worker = makeWorker({ weeklyAvgIncome: 5000, kycScore: 0, location: { zone: "default" } });
    const result = calculateDynamicPremium(plan, worker, { claimCount: 0, lastClaimDaysAgo: 999 });

    // zone=1.0, activity=1.0, claims=0.95 (no-claims), kyc=1.0 → 95
    expect(result.dynamicPremium).toBe(95);
    expect(result.discount).toBe(5);
    expect(result.breakdown.basePremium).toBe(100);
  });

  it("applies zone risk factor for flood-prone area", () => {
    const plan = makePlan({ weeklyPremium: 100 });
    const worker = makeWorker({ location: { zone: "Mumbai-Kurla" }, weeklyAvgIncome: 5000, kycScore: 0 });
    const result = calculateDynamicPremium(plan, worker, { claimCount: 0 });

    // zone=1.25, activity=1.0, claims=0.95, kyc=1.0 → 119
    expect(result.dynamicPremium).toBe(119);
    expect(result.breakdown.zoneRiskFactor).toBe(1.25);
  });

  it("applies activity multiplier for high earners", () => {
    const plan = makePlan({ weeklyPremium: 100 });
    const worker = makeWorker({ weeklyAvgIncome: 10000, kycScore: 0, location: { zone: "default" } });
    const result = calculateDynamicPremium(plan, worker, { claimCount: 0 });

    // zone=1.0, activity=1.10, claims=0.95, kyc=1.0 → 105
    expect(result.breakdown.activityMultiplier).toBe(1.10);
  });

  it("applies activity multiplier for low earners", () => {
    const plan = makePlan({ weeklyPremium: 100 });
    const worker = makeWorker({ weeklyAvgIncome: 2000, kycScore: 0, location: { zone: "default" } });
    const result = calculateDynamicPremium(plan, worker, { claimCount: 0 });

    expect(result.breakdown.activityMultiplier).toBe(0.90);
  });

  it("applies claims frequency penalty for frequent claimers", () => {
    const plan = makePlan({ weeklyPremium: 100 });
    const worker = makeWorker({ weeklyAvgIncome: 5000, kycScore: 0, location: { zone: "default" } });
    const result = calculateDynamicPremium(plan, worker, { claimCount: 5, lastClaimDaysAgo: 10 });

    // claims multiplier = 1.10
    expect(result.breakdown.claimsMultiplier).toBe(1.10);
  });

  it("applies KYC discount for fully verified workers", () => {
    const plan = makePlan({ weeklyPremium: 100 });
    const worker = makeWorker({ weeklyAvgIncome: 5000, kycScore: 90, location: { zone: "default" } });
    const result = calculateDynamicPremium(plan, worker, { claimCount: 0 });

    // zone=1.0, activity=1.0, claims=0.95, kyc=0.95 → 90
    expect(result.breakdown.kycDiscount).toBe(0.95);
  });

  it("returns non-negative discount", () => {
    const plan = makePlan({ weeklyPremium: 49 });
    const worker = makeWorker({ weeklyAvgIncome: 10000, kycScore: 0, location: { zone: "Mumbai-Dharavi" } });
    const result = calculateDynamicPremium(plan, worker, { claimCount: 6, lastClaimDaysAgo: 5 });

    expect(result.discount).toBeGreaterThanOrEqual(0);
    expect(result.dynamicPremium).toBeGreaterThan(0);
  });

  it("handles missing claimsHistory gracefully", () => {
    const plan = makePlan();
    const worker = makeWorker();
    const result = calculateDynamicPremium(plan, worker);

    expect(result).toHaveProperty("dynamicPremium");
    expect(result.breakdown.claimsMultiplier).toBe(0.95); // defaults to no-claims bonus
  });

  it("handles missing worker location zone (falls back to default)", () => {
    const plan = makePlan({ weeklyPremium: 100 });
    const worker = makeWorker({ location: {} });
    const result = calculateDynamicPremium(plan, worker, {});

    expect(result.breakdown.zoneRiskFactor).toBe(ZONE_RISK_REGISTRY.default);
  });
});

// ─── calculatePayout ─────────────────────────────────────

describe("calculatePayout", () => {
  const policy = {
    coveragePerHour: 75,
    maxPayoutPerEvent: 300,
    maxPayoutPerWeek: 1200,
    maxHoursPerEvent: 4,
  };

  it("calculates a basic payout for 2 disruption hours", () => {
    const result = calculatePayout(policy, 2, 0);
    expect(result.eligibleHours).toBe(2);
    expect(result.grossPayout).toBe(150); // 2 * 75
    expect(result.payoutAmount).toBe(150);
    expect(result.cappedBy).toBeNull();
  });

  it("caps eligible hours at maxHoursPerEvent", () => {
    const result = calculatePayout(policy, 10, 0);
    expect(result.eligibleHours).toBe(4); // capped at 4
    expect(result.grossPayout).toBe(300); // 4 * 75
  });

  it("caps payout at maxPayoutPerEvent", () => {
    // coveragePerHour=100, maxHoursPerEvent=6, grossPayout=600 > maxPayoutPerEvent=300
    const highCovPolicy = { ...policy, coveragePerHour: 100, maxHoursPerEvent: 6 };
    const result = calculatePayout(highCovPolicy, 6, 0);
    expect(result.payoutAmount).toBe(300); // capped at event cap
    expect(result.cappedBy).toBe("event_cap");
  });

  it("caps payout at remaining weekly cap", () => {
    // Already paid 1000, weekly cap 1200, event payout 300 → only 200 left
    const result = calculatePayout(policy, 4, 1000);
    expect(result.payoutAmount).toBe(200);
    expect(result.cappedBy).toBe("weekly_cap");
  });

  it("returns zero when weekly cap is exhausted", () => {
    const result = calculatePayout(policy, 2, 1200);
    expect(result.payoutAmount).toBe(0);
    expect(result.cappedBy).toBe("weekly_cap");
  });

  it("uses maxHoursPerEvent default of 6 when not set on policy", () => {
    const policyNoMax = { coveragePerHour: 50, maxPayoutPerEvent: 500, maxPayoutPerWeek: 1000 };
    const result = calculatePayout(policyNoMax, 10, 0);
    expect(result.eligibleHours).toBe(6); // default maxHoursPerEvent = 6
    expect(result.grossPayout).toBe(300); // 6 * 50
  });
});

// ─── estimateRiskScore ───────────────────────────────────

describe("estimateRiskScore", () => {
  it("returns a score between 0 and 1", () => {
    const worker = makeWorker({ kycScore: 50, location: { zone: "Mumbai-Andheri-West" } });
    const score = estimateRiskScore(worker);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns higher risk score for high-risk zone", () => {
    const lowRiskWorker = makeWorker({ kycScore: 50, location: { zone: "Mumbai-Colaba" } });
    const highRiskWorker = makeWorker({ kycScore: 50, location: { zone: "Mumbai-Dharavi" } });

    const lowScore = estimateRiskScore(lowRiskWorker);
    const highScore = estimateRiskScore(highRiskWorker);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it("returns lower risk score for high KYC", () => {
    const lowKyc = makeWorker({ kycScore: 0, location: { zone: "default" } });
    const highKyc = makeWorker({ kycScore: 100, location: { zone: "default" } });

    const lowScore = estimateRiskScore(lowKyc);
    const highScore = estimateRiskScore(highKyc);

    expect(highScore).toBeLessThan(lowScore);
  });

  it("handles missing location gracefully (defaults to zone=default)", () => {
    const worker = { name: "Test", kycScore: 0 };
    const score = estimateRiskScore(worker);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
