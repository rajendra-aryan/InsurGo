/**
 * Tests for the Signup page component.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Mock dependencies ────────────────────────────────────

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ register: mockRegister, loading: false }),
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

import Signup from "@/pages/Signup";

// ─── Helpers ──────────────────────────────────────────────

const renderSignup = () =>
  render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>
  );

// ─── Tests ────────────────────────────────────────────────

describe("Signup page", () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockNavigate.mockReset();
  });

  it("renders the signup form fields", () => {
    renderSignup();

    expect(screen.getByPlaceholderText("Rahul Kumar")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("9876543210")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Min 6 characters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows a validation error when password is too short", async () => {
    renderSignup();

    fireEvent.change(screen.getByPlaceholderText("Rahul Kumar"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByPlaceholderText("Min 6 characters"), { target: { value: "abc" } });

    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("calls register with the correct payload on valid submission", async () => {
    mockRegister.mockResolvedValue({ _id: "u1", phone: "9876543210" });
    renderSignup();

    fireEvent.change(screen.getByPlaceholderText("Rahul Kumar"), { target: { value: "Rahul Kumar" } });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByPlaceholderText("Min 6 characters"), { target: { value: "password123" } });

    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Rahul Kumar",
          phone: "9876543210",
          password: "password123",
          location: expect.objectContaining({ city: "Mumbai" }),
        })
      );
    });
  });

  it("navigates to /pricing after successful registration", async () => {
    mockRegister.mockResolvedValue({ _id: "u1", phone: "9876543210" });
    renderSignup();

    fireEvent.change(screen.getByPlaceholderText("Rahul Kumar"), { target: { value: "Rahul" } });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByPlaceholderText("Min 6 characters"), { target: { value: "password123" } });

    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/pricing");
    });
  });

  it("shows an error message when registration fails", async () => {
    mockRegister.mockRejectedValue(new Error("Phone number already registered"));
    renderSignup();

    fireEvent.change(screen.getByPlaceholderText("Rahul Kumar"), { target: { value: "Rahul" } });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByPlaceholderText("Min 6 characters"), { target: { value: "password123" } });

    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Phone number already registered")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows a generic error message when error is not an Error instance", async () => {
    mockRegister.mockRejectedValue("unexpected string error");
    renderSignup();

    fireEvent.change(screen.getByPlaceholderText("Rahul Kumar"), { target: { value: "Rahul" } });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByPlaceholderText("Min 6 characters"), { target: { value: "password123" } });

    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
    });
  });

  it("contains a link to the login page", () => {
    renderSignup();
    const loginLink = screen.getByRole("link", { name: /log in/i });
    expect(loginLink).toHaveAttribute("href", "/login");
  });
});
