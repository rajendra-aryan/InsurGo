/**
 * Tests for the Login page component.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Mock dependencies ────────────────────────────────────

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ login: mockLogin, loading: false }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import Login from "@/pages/Login";

// ─── Helpers ──────────────────────────────────────────────

const renderLogin = (locationState?: { from?: string }) =>
  render(
    <MemoryRouter
      initialEntries={locationState ? [{ pathname: "/login", state: locationState }] : ["/login"]}
    >
      <Login />
    </MemoryRouter>
  );

// ─── Tests ────────────────────────────────────────────────

describe("Login page", () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockNavigate.mockReset();
  });

  it("renders phone, password fields and submit button", () => {
    renderLogin();

    expect(screen.getByPlaceholderText("9876543210")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("calls login with phone and password on submit", async () => {
    mockLogin.mockResolvedValue({ _id: "u1", phone: "9876543210" });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("9876543210"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("9876543210", "password123");
    });
  });

  it("navigates to /dashboard after successful login (default redirect)", async () => {
    mockLogin.mockResolvedValue({ _id: "u1" });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("9876543210"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("shows an error message when login fails", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid phone or password"));
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("9876543210"), { target: { value: "bad" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "bad" } });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Invalid phone or password")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows generic error message for non-Error rejection", async () => {
    mockLogin.mockRejectedValue("network error");
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("9876543210"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "password123" } });
    fireEvent.submit(screen.getByRole("button", { name: /log in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/login failed/i)).toBeInTheDocument();
    });
  });

  it("contains a link to the signup page", () => {
    renderLogin();
    const signupLink = screen.getByRole("link", { name: /sign up/i });
    expect(signupLink).toHaveAttribute("href", "/signup");
  });

  it("shows demo hint text", () => {
    renderLogin();
    expect(screen.getByText(/register first/i)).toBeInTheDocument();
  });
});
