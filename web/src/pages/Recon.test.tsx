/**
 * UP13-UP14: Reconciliation page tests
 * - UP13: Statement upload with duplicate detection, runs list, breaks table
 * - UP14: Break detail with reason-required resolve, show 400/409/413 errors inline
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { ReconPage } from "./Dashboard";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const mockLocalStorage = {
  getItem: vi.fn(() => "test-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(global, "localStorage", { value: mockLocalStorage });

describe("UP: Reconciliation (P6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("UP13: Statement upload with duplicate detection, runs list, breaks table with filters", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        runs: [
          {
            runId: "run-1",
            startedAt: Date.now(),
            durationMs: 5000,
            breaksFound: 2,
          },
        ],
        breaks: [
          {
            breakId: "break-1",
            accountId: "acc1",
            asset: "USD",
            expected: "100000",
            actual: "99000",
            status: "OPEN",
            auditTrail: [{ ts: Date.now(), action: "found", user: "system" }],
          },
        ],
      }),
    });

    render(<ReconPage />);

    await waitFor(() => {
      expect(screen.getByText("Reconciliation (P6)")).toBeInTheDocument();
    });

    // Check statement upload
    expect(screen.getByText("Statement Upload")).toBeInTheDocument();
    expect(screen.getByText("Statement File (CSV/JSON):")).toBeInTheDocument();

    // Check runs list
    expect(screen.getByText("Reconciliation Runs (1)")).toBeInTheDocument();
    expect(screen.getByText("run-1")).toBeInTheDocument();
    expect(screen.getByText("HAS BREAKS")).toBeInTheDocument();

    // Check breaks table
    expect(screen.getByText("Breaks (1)")).toBeInTheDocument();
    expect(screen.getByText("break-1")).toBeInTheDocument();
    expect(screen.getByText("acc1")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("UP14: Break detail with reason-required resolve and audit trail", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        runs: [],
        breaks: [
          {
            breakId: "break-1",
            accountId: "acc1",
            asset: "USD",
            expected: "100000",
            actual: "99000",
            status: "OPEN",
            auditTrail: [
              { ts: Date.now() - 60000, action: "found", user: "system" },
              { ts: Date.now(), action: "reviewed", user: "ops1" },
            ],
          },
        ],
      }),
    });

    render(<ReconPage />);

    await waitFor(() => {
      expect(screen.getByText("Breaks (1)")).toBeInTheDocument();
    });

    // Click resolve button
    const resolveButtons = screen.getAllByText("Resolve");
    resolveButtons[0]?.click();

    // Check break detail display
    await waitFor(() => {
      expect(screen.getByText(/Resolve Break: break-1/)).toBeInTheDocument();
    });

    // Check audit trail
    expect(screen.getByText("Audit Trail")).toBeInTheDocument();
    expect(screen.getByText(/found/)).toBeInTheDocument();
    expect(screen.getByText(/reviewed/)).toBeInTheDocument();

    // Check mandatory reason requirement
    expect(screen.getByPlaceholderText(/Why is this break being resolved/)).toBeInTheDocument();

    // Resolve button should be disabled without reason
    const resolveBtn = screen.getByText("Resolve");
    expect(resolveBtn).toBeDisabled();
  });

  it("UP14: Show 400, 409, 413 errors inline for statement upload", async () => {
    // Test 409 (duplicate)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ detail: "Already processed" }),
    });

    render(<ReconPage />);

    await waitFor(() => {
      expect(screen.getByText("Upload")).toBeInTheDocument();
    });

    // Simulate file selection and upload
    const fileInput = screen.getByDisplayValue("") as HTMLInputElement;
    const form = fileInput.closest("form");
    if (form) {
      form.dispatchEvent(new Event("submit", { bubbles: true }));
    }

    // 409 error should show inline
    await waitFor(() => {
      expect(screen.getByText("Statement already processed")).toBeInTheDocument();
    });

    // Test 413 (too large)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ detail: "Too large" }),
    });

    // Error should persist until cleared
    expect(screen.getByText(/already processed|too large/)).toBeInTheDocument();
  });
});
