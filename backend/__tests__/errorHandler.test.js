const { notFound, errorHandler } = require("../src/middleware/errorHandler");

// ─── notFound ─────────────────────────────────────────────

describe("notFound", () => {
  it("creates a 404 error and calls next", () => {
    const req = { originalUrl: "/api/missing-route" };
    const res = { status: jest.fn().mockReturnThis() };
    const next = jest.fn();

    notFound(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0];
    expect(err.message).toContain("/api/missing-route");
  });
});

// ─── errorHandler ────────────────────────────────────────

describe("errorHandler", () => {
  const makeRes = (statusCode = 200) => ({
    statusCode,
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  const req = { originalUrl: "/api/test" };
  const next = jest.fn();

  it("returns 500 when statusCode is still 200", () => {
    const res = makeRes(200);
    const err = new Error("Something broke");

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Something broke" })
    );
  });

  it("preserves the original statusCode when it is not 200", () => {
    const res = makeRes(400);
    const err = new Error("Bad request");

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("handles Mongoose CastError (invalid ObjectId)", () => {
    const res = makeRes(200);
    const err = { name: "CastError", message: "Cast to ObjectId failed", stack: "" };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Invalid resource ID" })
    );
  });

  it("handles Mongoose duplicate key error (code 11000)", () => {
    const res = makeRes(200);
    const err = {
      message: "E11000 duplicate key",
      code: 11000,
      keyValue: { phone: "9876543210" },
      stack: "",
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "phone already exists" })
    );
  });

  it("handles Mongoose ValidationError", () => {
    const res = makeRes(200);
    const err = {
      name: "ValidationError",
      errors: {
        phone: { message: "Phone is required" },
        name: { message: "Name is required" },
      },
      stack: "",
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.message).toContain("Phone is required");
    expect(body.message).toContain("Name is required");
  });

  it("does not expose stack trace in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const res = makeRes(200);
    const err = new Error("Server error");
    err.stack = "Error: Server error\n  at <stack>";

    errorHandler(err, req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  it("exposes stack trace in development", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const res = makeRes(200);
    const err = new Error("Server error");
    err.stack = "Error: Server error\n  at <stack>";

    errorHandler(err, req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.stack).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });
});
