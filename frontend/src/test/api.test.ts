/**
 * Tests for the frontend API client (src/lib/api.ts).
 * All fetch calls are mocked — no real network requests.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getToken,
  setToken,
  clearToken,
  authApi,
  policyApi,
  claimApi,
  eventApi,
} from "@/lib/api";

// ─── localStorage mock ────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// ─── fetch mock helper ────────────────────────────────────

function mockFetch(body: unknown, ok = true, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  }));
}

// ─── Token Management ─────────────────────────────────────

describe("Token helpers", () => {
  beforeEach(() => localStorageMock.clear());

  it("getToken returns null when not set", () => {
    expect(getToken()).toBeNull();
  });

  it("setToken stores the token in localStorage", () => {
    setToken("my_token_abc");
    expect(getToken()).toBe("my_token_abc");
  });

  it("clearToken removes the token and user from localStorage", () => {
    setToken("my_token_abc");
    localStorage.setItem("insurgo_user", JSON.stringify({ name: "Test" }));

    clearToken();

    expect(getToken()).toBeNull();
    expect(localStorage.getItem("insurgo_user")).toBeNull();
  });
});

// ─── authApi ──────────────────────────────────────────────

describe("authApi.login", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls POST /auth/login and returns token + user", async () => {
    mockFetch({ success: true, token: "tok123", data: { user: { phone: "9876543210" } } });

    const result = await authApi.login("9876543210", "password123");

    expect(result.token).toBe("tok123");
    expect(result.data.user.phone).toBe("9876543210");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws with the server error message on failure", async () => {
    mockFetch({ success: false, message: "Invalid phone or password" }, false, 401);

    await expect(authApi.login("bad", "bad")).rejects.toThrow("Invalid phone or password");
  });
});

describe("authApi.register", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls POST /auth/register and returns token + user", async () => {
    mockFetch({ success: true, token: "tok_reg", data: { user: { phone: "9876543210" } } });

    const result = await authApi.register({
      name: "Test",
      phone: "9876543210",
      password: "password123",
    });

    expect(result.token).toBe("tok_reg");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/auth/register"),
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("authApi.getMe", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends Authorization header when token is set", async () => {
    setToken("bearer_token_xyz");
    mockFetch({ success: true, data: { user: { name: "Test" } } });

    await authApi.getMe();

    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect((opts?.headers as Record<string, string>)["Authorization"]).toBe("Bearer bearer_token_xyz");
  });

  afterEach(() => localStorageMock.clear());
});

// ─── policyApi ────────────────────────────────────────────

describe("policyApi.getPlans", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls GET /policies/plans and returns plans array", async () => {
    const plans = [{ _id: "1", name: "smart", displayName: "Smart Shield" }];
    mockFetch({ success: true, data: { plans } });

    const result = await policyApi.getPlans();

    expect(result.data.plans).toHaveLength(1);
    expect(result.data.plans[0].name).toBe("smart");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/policies/plans"),
      expect.any(Object)
    );
  });

  it("throws when backend is unreachable (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(policyApi.getPlans()).rejects.toThrow("Failed to fetch");
  });
});

describe("policyApi.subscribe", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls POST /policies/subscribe with planId", async () => {
    mockFetch({ success: true, data: { policy: {}, payment: { orderId: "ord_1" } } });

    const result = await policyApi.subscribe("plan_123");

    expect(result.data.payment.orderId).toBe("ord_1");
    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect(opts?.method).toBe("POST");
    expect(JSON.parse(opts?.body as string)).toEqual({ planId: "plan_123" });
  });
});

describe("policyApi.cancel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls DELETE /policies/:id/cancel", async () => {
    mockFetch({ success: true });

    await policyApi.cancel("policy_abc", "No longer needed");

    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/policies/policy_abc/cancel");
    expect(opts?.method).toBe("DELETE");
  });
});

// ─── claimApi ─────────────────────────────────────────────

describe("claimApi.getMyClaims", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls GET /claims/my without filter", async () => {
    mockFetch({ success: true, data: { claims: [], pagination: {} } });

    await claimApi.getMyClaims();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/claims/my");
    expect(url).not.toContain("status=");
  });

  it("appends status filter to the URL when provided", async () => {
    mockFetch({ success: true, data: { claims: [], pagination: {} } });

    await claimApi.getMyClaims("paid");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("status=paid");
  });
});

// ─── eventApi ─────────────────────────────────────────────

describe("eventApi.getActive", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls GET /events/active", async () => {
    mockFetch({ success: true, count: 0, data: { events: [] } });

    const result = await eventApi.getActive();

    expect(result.data.events).toHaveLength(0);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/events/active");
  });
});

describe("eventApi.liveCheck", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls GET /events/live-check with city parameter", async () => {
    mockFetch({ success: true, data: { city: "Delhi", overallStatus: "ALL_CLEAR" } });

    await eventApi.liveCheck("Delhi");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("city=Delhi");
  });

  it("defaults to Mumbai when no city is given", async () => {
    mockFetch({ success: true, data: { city: "Mumbai", overallStatus: "ALL_CLEAR" } });

    await eventApi.liveCheck();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("city=Mumbai");
  });
});
