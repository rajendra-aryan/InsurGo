const { buildMlPayload } = require("../src/services/mlDecisionService");

describe("mlDecisionService.buildMlPayload", () => {
  it("sets low_movement=1 when distance is below threshold", () => {
    const payload = buildMlPayload({
      gpsSnapshot: { distanceMovedM: 199, speed: 12 },
      claimAmount: 100,
    });

    expect(payload.low_movement).toBe(1);
  });

  it("sets low_movement=0 at threshold boundary", () => {
    const payload = buildMlPayload({
      gpsSnapshot: { distanceMovedM: 200, speed: 12 },
      claimAmount: 100,
    });

    expect(payload.low_movement).toBe(0);
  });

  it("sets high_risk_zone=1 for heavy rainfall", () => {
    const payload = buildMlPayload({
      event: { rawData: { rainfallMm: 61, aqiValue: 100 } },
      claimAmount: 100,
    });

    expect(payload.high_risk_zone).toBe(1);
  });

  it("sets high_risk_zone=1 for severe AQI", () => {
    const payload = buildMlPayload({
      event: { rawData: { rainfallMm: 10, aqiValue: 301 } },
      claimAmount: 100,
    });

    expect(payload.high_risk_zone).toBe(1);
  });

  it("sets high_risk_zone=0 at exact thresholds", () => {
    const payload = buildMlPayload({
      event: { rawData: { rainfallMm: 60, aqiValue: 300 } },
      claimAmount: 100,
    });

    expect(payload.high_risk_zone).toBe(0);
  });

  it("always includes risk_score key for trigger/risk engine compatibility", () => {
    const payload = buildMlPayload({
      claimAmount: 100,
    });

    expect(payload).toHaveProperty("risk_score", null);
  });
});
