/**
 * Tests for the CORS configuration in src/app.js.
 * Verifies that localhost origins are allowed in development
 * and non-localhost origins are blocked.
 */

process.env.JWT_SECRET = "test_secret";
process.env.NODE_ENV = "development";

// Mock mongoose so app.js can be loaded without a DB connection
jest.mock("mongoose", () => ({
  connect: jest.fn().mockResolvedValue({}),
  connection: { collections: {} },
  model: jest.fn().mockReturnValue({}),
  Schema: class {
    constructor() {}
    pre() { return this; }
    methods = {};
    virtual() { return { get: () => {} }; }
    static() {}
  },
}));

// Mock all route modules to avoid model imports
jest.mock("../src/routes/auth", () => require("express").Router());
jest.mock("../src/routes/policies", () => require("express").Router());
jest.mock("../src/routes/claims", () => require("express").Router());
jest.mock("../src/routes/events", () => require("express").Router());
jest.mock("../src/routes/premium", () => require("express").Router());

jest.mock("../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
jest.mock("../src/services/mlDecisionService", () => ({
  getMlHealth: jest.fn().mockResolvedValue({ ok: true, status: 200 }),
}));

const request = require("supertest");

// Fresh require to pick up NODE_ENV=development
let app;
beforeAll(() => {
  app = require("../src/app");
});

afterAll(() => {
  jest.resetModules();
});

describe("CORS configuration", () => {
  const devOrigins = [
    "http://localhost:8080",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:5173",
  ];

  devOrigins.forEach((origin) => {
    it(`allows dev origin: ${origin}`, async () => {
      const res = await request(app)
        .options("/health")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST");

      // Should NOT block (no CORS error = no 403/500 from CORS)
      expect([200, 204, 404]).toContain(res.status);
      expect(res.headers["access-control-allow-origin"]).toBe(origin);
    });
  });

  it("blocks requests from a non-localhost origin in development", async () => {
    const res = await request(app)
      .options("/health")
      .set("Origin", "https://evil.attacker.com")
      .set("Access-Control-Request-Method", "POST");

    // CORS middleware should not set allow-origin for untrusted origins
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows requests with no origin (e.g. server-to-server, curl)", async () => {
    const res = await request(app).get("/health");
    expect([200, 404]).toContain(res.status);
  });
});
