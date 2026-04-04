/**
 * InsurGo Frontend API Client
 * All calls go through this file — single source of truth for backend communication.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ─── Token Management ─────────────────────────────────────

export const getToken = (): string | null => localStorage.getItem("insurgo_token");
export const setToken = (token: string) => localStorage.setItem("insurgo_token", token);
export const clearToken = () => {
  localStorage.removeItem("insurgo_token");
  localStorage.removeItem("insurgo_user");
};

// ─── Base Fetch ───────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.message || `Request failed: ${res.status}`) as Error & {
      code?: string;
      data?: unknown;
      status?: number;
    };
    error.code = data?.code;
    error.data = data?.data;
    error.status = res.status;
    throw error;
  }
  return data;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "DELETE", body: body ? JSON.stringify(body) : undefined });

// ─── Types ────────────────────────────────────────────────

export interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  kycVerified: boolean;
  kycScore: number;
  platformVerified: boolean;
  deliveryPlatform?: string;
  avgHourlyIncome: number;
  weeklyAvgIncome: number;
  location?: { lat?: number; lng?: number; zone?: string; city?: string };
  bankAccount?: { accountNumber?: string; ifsc?: string; accountHolderName?: string };
  fraudScore: number;
  isBlocked: boolean;
  createdAt: string;
}

export interface Plan {
  _id: string;
  name: string;
  displayName: string;
  weeklyPremium: number;
  coveragePerHour: number;
  maxPayoutPerEvent: number;
  maxPayoutPerWeek: number;
  maxHoursPerEvent: number;
  description: string;
  triggerTypes: string[];
}

export interface Policy {
  _id: string;
  planName: string;
  weeklyPremium: number;
  dynamicPremium?: number;
  coveragePerHour: number;
  maxPayoutPerEvent: number;
  maxPayoutPerWeek: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  premiumPaid: boolean;
  totalPayoutThisPeriod: number;
  claimsThisPeriod: number;
  razorpayOrderId?: string;
  mlDecision?: {
    modelVersion?: string;
    provider?: string;
    decisionAt?: string;
    riskScore?: number;
    predictedPremium?: number;
    claimTriggered?: boolean;
    triggerReasons?: string[];
    available?: boolean;
  };
}

export interface Claim {
  _id: string;
  payoutAmount: number;
  grossPayout: number;
  status: "pending" | "approved" | "manual_review" | "rejected" | "paid";
  fraudScore: number;
  createdAt: string;
  eventId?: { type: string; city: string; severity: string; detectedAt: string };
  policyId?: { planName: string; coveragePerHour: number };
  mlDecision?: {
    modelVersion?: string;
    decisionAt?: string;
    claimTriggered?: boolean;
    triggerReasons?: string[];
    available?: boolean;
  };
}

export interface ClaimStats {
  totalClaims: number;
  paidClaims: number;
  pendingClaims: number;
  rejectedClaims: number;
  totalPaidOut: number;
}

export interface ActiveEvent {
  _id: string;
  type: string;
  severity: string;
  city: string;
  triggerValue: number;
  triggerThreshold: number;
  detectedAt: string;
  isActive: boolean;
}

export interface LiveCheckResult {
  city: string;
  timestamp: string;
  overallStatus: "DISRUPTION_DETECTED" | "ALL_CLEAR";
  checks: {
    rain?: { value: number; threshold: number; breached: boolean; description: string; status: string };
    aqi?: { value: number; threshold: number; breached: boolean; severity: string; status: string };
    curfew?: { active: boolean; status: string };
  };
}

// ─── Auth ─────────────────────────────────────────────────

export const authApi = {
  register: (data: {
    name: string; phone: string; email?: string; password: string;
    deliveryPlatform?: string; avgHourlyIncome?: number; weeklyAvgIncome?: number;
    location?: { zone?: string; city?: string };
  }) => post<{ success: boolean; token: string; data: { user: User } }>("/auth/register", data),

  login: (phone: string, password: string) =>
    post<{ success: boolean; token: string; data: { user: User } }>("/auth/login", { phone, password }),

  getMe: () => get<{ success: boolean; data: { user: User } }>("/auth/me"),

  updateMe: (data: Partial<User>) =>
    patch<{ success: boolean; data: { user: User } }>("/auth/me", data),

  heartbeat: (lat?: number, lng?: number) =>
    post<{ success: boolean }>("/auth/heartbeat", { lat, lng }),

  sendPhoneOtp: () =>
    post<{ success: boolean; data: { otpSent: boolean; expiresAt: string; devOtp?: string } }>(
      "/auth/phone-otp/send",
      {}
    ),

  verifyPhoneOtp: (otp: string) =>
    post<{ success: boolean; data: { user: User } }>("/auth/phone-otp/verify", { otp }),
};

// ─── Policies ─────────────────────────────────────────────

export const policyApi = {
  getPlans: () => get<{ success: boolean; data: { plans: Plan[] } }>("/policies/plans"),

  getQuote: (planId: string) =>
    get<{
      success: boolean;
      data: {
        plan: Plan;
        quote: {
          dynamicPremium: number;
          discount: number;
          breakdown: Record<string, unknown>;
          mlDecision?: { available: boolean; modelVersion?: string; decisionAt?: string; triggerReasons?: string[] };
        };
      };
    }>(
      `/policies/plans/${planId}/quote`
    ),

  subscribe: (planId: string) =>
    post<{
      success: boolean;
      data: {
        policy: Policy;
        payment: { orderId: string; amount: number; currency: string; keyId: string };
      };
    }>("/policies/subscribe", { planId }),

  confirmPayment: (policyId: string, payload: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    post<{ success: boolean; data: { policy: Policy } }>(
      `/policies/${policyId}/confirm-payment`,
      payload
    ),

  getMyPolicies: () =>
    get<{ success: boolean; data: { active: Policy | null; history: Policy[]; totalPolicies: number } }>("/policies/my"),

  cancel: (policyId: string, reason?: string) =>
    del<{ success: boolean }>(`/policies/${policyId}/cancel`, { reason }),
};

// ─── Claims ───────────────────────────────────────────────

export const claimApi = {
  getMyClaims: (status?: string) =>
    get<{ success: boolean; data: { claims: Claim[]; pagination: unknown } }>(
      `/claims/my${status ? `?status=${status}` : ""}`
    ),

  getStats: () =>
    get<{ success: boolean; data: ClaimStats }>("/claims/stats"),

  submitManual: (eventId: string, gpsSnapshot?: { lat: number; lng: number; speed?: number }) =>
    post<{
      success: boolean;
      message: string;
      data: {
        claim: Claim;
        fraud: unknown;
        payout: unknown;
        mlDecision?: { available: boolean; claimTriggered?: boolean; triggerReasons?: string[]; modelVersion?: string };
      };
    }>(
      "/claims/manual",
      { eventId, gpsSnapshot }
    ),
};

// ─── Events ───────────────────────────────────────────────

export const eventApi = {
  getActive: () =>
    get<{ success: boolean; count: number; data: { events: ActiveEvent[] } }>("/events/active"),

  liveCheck: (city = "Mumbai") =>
    get<{ success: boolean; data: LiveCheckResult }>(`/events/live-check?city=${city}`),
};

// ─── Premium ──────────────────────────────────────────────

export const premiumApi = {
  getMyRiskProfile: () =>
    get<{
      success: boolean;
      data: {
        riskScore: number;
        riskLevel: string;
        zone: string;
        zoneRiskFactor: number;
        kycScore: number;
        recentClaims30Days: number;
        premiumsByPlan: Array<{ planId: string; planName: string; basePremium: number; dynamicPremium: number; discount: number }>;
        mlDecision?: { available: boolean; modelVersion?: string; decisionAt?: string; triggerReasons?: string[] };
      };
    }>("/premium/my-risk-profile"),

  getZoneRiskMap: () =>
    get<{ success: boolean; data: { zones: Array<{ zone: string; riskFactor: number; riskLevel: string }> } }>(
      "/premium/zone-risk"
    ),

  getMlStatus: () =>
    get<{ success: boolean; data: { ok: boolean; status: number; url: string } }>("/premium/ml-status"),
};
