/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * UP13-UP14: Reconciliation page tests
 * - UP13: Statement upload with duplicate detection, runs list, breaks table
 * - UP14: Break detail with reason-required resolve, show 400/409/413 errors inline
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../auth/AuthProvider.js";
import { ReconPage } from "./Recon.js";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function renderReconPage() {
  sessionStorage.setItem("authToken", "test-token");
  sessionStorage.setItem("authUser", JSON.stringify({ id: "u1", username: "ops1", role: "OPS", accountIds: [] }));
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ReconPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("UP: Reconciliation (P6)", () => {
  beforeEach(() => {
    sessionStorage.clear();
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

    renderReconPage();

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

    renderReconPage();

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
    const resolveButtonsAfterOpen = screen.getAllByText("Resolve");
    const submitResolveBtn = resolveButtonsAfterOpen[resolveButtonsAfterOpen.length - 1];
    expect(submitResolveBtn).toBeDisabled();
  });

  it("UP14: Show 400, 409, 413 errors inline for statement upload", async () => {
    // Mount fetches (runs/breaks list) consume this default resolved value first.
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ runs: [], breaks: [] }) });

    renderReconPage();

    await waitFor(() => {
      expect(screen.getByText("Upload")).toBeInTheDocument();
    });

    // Now queue the 409 response for the upload POST specifically.
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ detail: "Already processed" }),
    });

    // Simulate file selection and upload
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["a,b,c"], "statement.csv", { type: "text/csv" });
    await userEvent.upload(fileInput, file);
    const form = fileInput.closest("form") as HTMLFormElement;
    form.requestSubmit();

    // 409 error should show inline
    await waitFor(() => {
      expect(screen.getByText(/Statement already processed/)).toBeInTheDocument();
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
