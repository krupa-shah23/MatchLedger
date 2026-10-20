/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * UP11-UP12: Risk console page tests
 * - UP11: Render breaker table with incident clock, resting orders, rejections feed
 * - UP12: Halt/resume with mandatory reason, resume shows HALF_OPEN
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { RiskPage } from "./Dashboard";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const mockLocalStorage = {
  getItem: vi.fn(() => "test-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(global, "localStorage", { value: mockLocalStorage });

describe("UP: Risk Console (P5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("UP11: Render breaker table with incident clock, resting orders, held funds, rejections feed", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        breakers: [
          {
            symbol: "ACME",
            status: "ACTIVE",
            incidentStartTs: Date.now() - 30000, // 30s ago
            count: 5,
          },
        ],
        rejections: [
          {
            symbol: "ACME",
            accountId: "acc1",
            reason: "INSUFFICIENT_BALANCE",
            ts: Date.now(),
            snapshot: { heldCash: "50000" },
          },
        ],
      }),
    });

    render(<RiskPage />);

    await waitFor(() => {
      expect(screen.getByText("Risk Console (P5)")).toBeInTheDocument();
    });

    // Check breaker table
    expect(screen.getByText("Breakers")).toBeInTheDocument();
    expect(screen.getByText("Symbol")).toBeInTheDocument();
    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();

    // Check incident clock columns
    expect(screen.getByText("Incident Time")).toBeInTheDocument();
    expect(screen.getByText("Time Remaining")).toBeInTheDocument();

    // Check resting orders and held funds
    expect(screen.getByText("Resting Orders")).toBeInTheDocument();
    expect(screen.getByText("Held Funds")).toBeInTheDocument();

    // Check rejections feed
    expect(screen.getByText(/Rejections Feed/)).toBeInTheDocument();
    expect(screen.getByText("INSUFFICIENT_BALANCE")).toBeInTheDocument();
  });

  it("UP12: Halt/resume with mandatory reason, resume shows HALF_OPEN state", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        breakers: [],
        rejections: [],
      }),
    });

    render(<RiskPage />);

    await waitFor(() => {
      expect(screen.getByText("Halt/Resume")).toBeInTheDocument();
    });

    // Check halt/resume section
    expect(screen.getByText("Halt Symbol")).toBeInTheDocument();
    expect(screen.getByText("Resume Symbol")).toBeInTheDocument();

    // Check mandatory reason requirement
    const reasons = screen.getAllByPlaceholderText(/Why are you/);
    expect(reasons.length).toBeGreaterThan(0);

    // Resume button should mention HALF_OPEN
    const buttons = screen.getAllByText(/Resume/);
    expect(buttons.some((b) => b.textContent?.includes("HALF_OPEN"))).toBe(true);
  });
});
