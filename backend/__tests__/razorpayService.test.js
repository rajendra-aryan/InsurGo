jest.mock("razorpay", () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockRejectedValue({ response: { data: {} } }),
    },
  }));
});

jest.mock("axios", () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

jest.mock("../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const {
  createPremiumOrder,
  initiatePayout,
  verifyPaymentSignature,
  buildPremiumReceipt,
} = require("../src/services/razorpayService");

describe("razorpayService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
    process.env.RAZORPAY_ACCOUNT_NUMBER = "1234567890";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns non-undefined fallback when order creation error lacks message fields", async () => {
    await expect(createPremiumOrder(4900, "policy_1")).rejects.toThrow(
      "Failed to create payment order: Unknown Razorpay order creation error"
    );
  });

  it("builds receipt with length <= 40 for long policy ids", () => {
    const receipt = buildPremiumReceipt("temp_123456789012345678901234567890_verylongplanid");
    expect(receipt.length).toBeLessThanOrEqual(40);
    expect(receipt.startsWith("premium_")).toBe(true);
  });

  it("throws explicit config error when payout account number is missing", async () => {
    delete process.env.RAZORPAY_ACCOUNT_NUMBER;
    await expect(
      initiatePayout({
        fundAccountId: "fa_1",
        amountInPaise: 1000,
        claimId: "claim_1",
        workerName: "Worker",
      })
    ).rejects.toThrow("Payout failed: Missing Razorpay configuration: RAZORPAY_ACCOUNT_NUMBER");
  });

  it("throws explicit config error when key secret is missing during signature verification", () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(() =>
      verifyPaymentSignature({
        orderId: "order_1",
        paymentId: "pay_1",
        signature: "sig_1",
      })
    ).toThrow("Missing Razorpay configuration: RAZORPAY_KEY_SECRET");
  });
});
