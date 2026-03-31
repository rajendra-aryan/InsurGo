/**
 * Tests for the Pricing page component.
 */

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Mocks ────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    policyApi: { getPlans: vi.fn() },
    getToken: vi.fn(),
  };
});

import Pricing from "@/pages/Pricing";
import { policyApi, getToken } from "@/lib/api";

const mockGetPlans = vi.mocked(policyApi.getPlans);
const mockGetToken = vi.mocked(getToken);

const MOCK_PLANS = [
  {
    _id: "plan_lite",
    name: "lite",
    displayName: "Lite Shield",
    weeklyPremium: 29,
    coveragePerHour: 57,
    maxPayoutPerEvent: 200,
    maxPayoutPerWeek: 400,
    maxHoursPerEvent: 4,
    description: "Best for part-time riders.",
    triggerTypes: ["rain", "aqi"],
  },
  {
    _id: "plan_smart",
    name: "smart",
    displayName: "Smart Shield",
    weeklyPremium: 49,
    coveragePerHour: 75,
    maxPayoutPerEvent: 300,
    maxPayoutPerWeek: 1200,
    maxHoursPerEvent: 4,
    description: "Best for regular riders.",
    triggerTypes: ["rain", "aqi", "flood", "curfew"],
  },
  {
    _id: "plan_flex",
    name: "flex",
    displayName: "Daily Flex",
    weeklyPremium: 35,
    coveragePerHour: 50,
    maxPayoutPerEvent: 150,
    maxPayoutPerWeek: 750,
    maxHoursPerEvent: 3,
    description: "Pay only on work days.",
    triggerTypes: ["rain", "aqi"],
  },
];

const renderPricing = () =>
  render(
    <MemoryRouter>
      <Pricing />
    </MemoryRouter>
  );

// ─── Tests ────────────────────────────────────────────────

describe("Pricing page", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it("shows a loading spinner initially", () => {
    // Never resolves — stays in loading state
    mockGetPlans.mockReturnValue(new Promise(() => {}));
    renderPricing();

    expect(screen.getByText(/loading plans/i)).toBeInTheDocument();
  });

  it("renders plan cards when plans are loaded successfully", async () => {
    mockGetPlans.mockResolvedValue({ success: true, data: { plans: MOCK_PLANS } } as never);
    renderPricing();

    await waitFor(() => {
      expect(screen.getByText("Lite Shield")).toBeInTheDocument();
      expect(screen.getByText("Smart Shield")).toBeInTheDocument();
    });
  });

  it("renders the Daily Flex plan separately", async () => {
    mockGetPlans.mockResolvedValue({ success: true, data: { plans: MOCK_PLANS } } as never);
    renderPricing();

    await waitFor(() => {
      expect(screen.getByText("Daily Flex")).toBeInTheDocument();
    });
  });

  it("shows error message (with actual error text) when backend call fails", async () => {
    mockGetPlans.mockRejectedValue(new Error("Failed to fetch"));
    renderPricing();

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch")).toBeInTheDocument();
    });
  });

  it("shows 'no plans found' message when plans array is empty", async () => {
    mockGetPlans.mockResolvedValue({ success: true, data: { plans: [] } } as never);
    renderPricing();

    await waitFor(() => {
      expect(screen.getByText(/no insurance plans found/i)).toBeInTheDocument();
      expect(screen.getByText(/npm run seed/i)).toBeInTheDocument();
    });
  });

  it("navigates to /signup when unauthenticated user clicks Get Started", async () => {
    mockGetToken.mockReturnValue(null); // not logged in
    mockGetPlans.mockResolvedValue({ success: true, data: { plans: MOCK_PLANS } } as never);
    renderPricing();

    await waitFor(() => screen.getAllByRole("button", { name: /get started/i }));

    const buttons = screen.getAllByRole("button", { name: /get started/i });
    fireEvent.click(buttons[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/signup");
  });

  it("navigates to /payment with correct query params when authenticated user clicks Get Started", async () => {
    mockGetToken.mockReturnValue("some_token");
    mockGetPlans.mockResolvedValue({ success: true, data: { plans: MOCK_PLANS } } as never);
    renderPricing();

    await waitFor(() => screen.getAllByRole("button", { name: /get started/i }));

    const buttons = screen.getAllByRole("button", { name: /get started/i });
    fireEvent.click(buttons[0]);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("/payment?planId=")
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("planName=")
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("amount=")
    );
  });

  it("marks the 'smart' plan as Most Popular", async () => {
    mockGetPlans.mockResolvedValue({ success: true, data: { plans: MOCK_PLANS } } as never);
    renderPricing();

    await waitFor(() => {
      expect(screen.getByText(/most popular/i)).toBeInTheDocument();
    });
  });

  it("shows a Retry button on error that reloads the page", async () => {
    mockGetPlans.mockRejectedValue(new Error("Failed to fetch"));

    // jsdom disallows spy on window.location.reload; replace the whole location
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    renderPricing();

    await waitFor(() => screen.getByRole("button", { name: /retry/i }));
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(reloadMock).toHaveBeenCalled();
  });
});
