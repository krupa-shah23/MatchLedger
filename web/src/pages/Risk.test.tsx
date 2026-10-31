/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * UP11-UP12: Risk console page tests
 * - UP11: Render breaker table with incident clock, resting orders, rejections feed
 * - UP12: Halt/resume with mandatory reason, resume shows HALF_OPEN
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider.js";
import { ToastProvider } from "../components/Toast.js";
import { RiskPage } from "./Risk.js";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function renderRiskPage() {
  sessionStorage.setItem("authToken", "test-token");
  sessionStorage.setItem("authUser", JSON.stringify({ id: "u1", username: "risk1", role: "RISK", accountIds: [] }));
  return render(
    <MemoryRouter>
      <ToastProvider><AuthProvider><RiskPage /></AuthProvider></ToastProvider>
    </MemoryRouter>
  );
}

describe("UP: Risk Console", () => {
  beforeEach(() => {
    sessionStorage.clear();
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

    renderRiskPage();

    await waitFor(() => {
      expect(screen.getByText("Risk Console")).toBeInTheDocument();
    });

    // Check breaker table
    expect(screen.getByText("Breakers")).toBeInTheDocument();
    expect(screen.getAllByText("Symbol")[0]).toBeInTheDocument();
    expect(screen.getAllByText("ACME")[0]).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();

    // Check incident clock columns
    expect(screen.getByText("Incident Time")).toBeInTheDocument();
    expect(screen.getByText("Incident Duration")).toBeInTheDocument();

    // Check resting orders and held funds
    expect(screen.getByText("Resting Orders")).toBeInTheDocument();
    expect(screen.getByText("Held Funds")).toBeInTheDocument();

    // Check rejections feed
    expect(screen.getByText(/Rejections Feed/)).toBeInTheDocument();
    expect(screen.getByText("INSUFFICIENT_BALANCE")).toBeInTheDocument();
  });

  it("UP12: Halt/resume with mandatory reason, resume shows HALF_OPEN state", async () => {
    let breakerState = "OPEN";
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).endsWith("/risk/symbols/ACME/resume")) {
        breakerState = "HALF_OPEN";
        return Promise.resolve({ ok: true, status: 202, json: async () => ({ symbol: "ACME" }) });
      }
      if (String(input).endsWith("/risk/breakers")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [{ symbol: "ACME", state: breakerState, incidentStartTs: Date.now() - 1000, count: 1 }] });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    renderRiskPage();

    await waitFor(() => {
      expect(screen.getByText("Halt/Resume")).toBeInTheDocument();
    });

    // Check halt/resume section
    expect(screen.getByText("Halt Symbol")).toBeInTheDocument();
    expect(screen.getByText("Resume Symbol")).toBeInTheDocument();

    // Select the halted symbol from its row to reveal the resume form
    const rowResumeButtons = screen.getAllByText("Resume");
    rowResumeButtons[0]!.click();

    // Check mandatory reason requirement
    const reasons = await screen.findAllByPlaceholderText(/Why are you/);
    expect(reasons.length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Why are you resuming this symbol?"), { target: { value: "Incident reviewed" } });
    fireEvent.click(screen.getByRole("button", { name: /Resume \(→ HALF_OPEN\)/ }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ACME is now HALF_OPEN"));
  });

  it("shows the server's permission error when a risk action is forbidden", async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).endsWith("/risk/symbols/ACME/halt")) {
        return Promise.resolve({ ok: false, status: 403, json: async () => ({ detail: "Missing required role: RISK" }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ breakers: [{ symbol: "ACME", status: "CLOSED", incidentStartTs: "" }], rejections: [] }) });
    });

    renderRiskPage();
    await screen.findByText("Risk Console");
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Audit check" } });
    fireEvent.click(screen.getByRole("button", { name: "Halt" }));

    expect(await screen.findByText("Could not halt ACME: Missing required role: RISK")).toBeInTheDocument();
  });
});
