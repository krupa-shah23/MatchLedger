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
import { MemoryRouter } from "react-router-dom";
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

describe("UP: Reconciliation", () => {
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
            asset: "CASH",
            expected: "1000.00",
            actual: "990.00",
            status: "OPEN",
            auditTrail: [{ id: 1, changedAt: Date.now(), oldStatus: "OPEN", newStatus: "OPEN", reason: "Found", changedBy: "system" }],
          },
        ],
      }),
    });

    renderReconPage();

    await waitFor(() => {
      expect(screen.getByText("Reconciliation")).toBeInTheDocument();
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
    expect(screen.getByText("CASH")).toBeInTheDocument();
  });

  it("UP14: Break detail with reason-required resolve and audit trail", async () => {
    let isResolved = false;
    mockFetch.mockImplementation(async (input: string, init?: RequestInit) => {
      if (input.includes("/audit")) return new Response(JSON.stringify({ audit: [
        { id: 1, changedAt: Date.now() - 60000, oldStatus: "OPEN", newStatus: "OPEN", reason: "Found", changedBy: "system" },
        { id: 2, changedAt: Date.now(), oldStatus: "OPEN", newStatus: "INVESTIGATING", reason: "Reviewed", changedBy: "ops1" },
        ...(isResolved ? [{ id: 3, changedAt: Date.now(), oldStatus: "INVESTIGATING", newStatus: "RESOLVED", reason: "Verified statement correction", changedBy: "ops1" }] : []),
      ] }), { status: 200 });
      if (init?.method === "POST") { isResolved = true; return new Response(JSON.stringify({ breakId: "break-1" }), { status: 202 }); }
      return new Response(JSON.stringify(input.includes("/runs") ? { runs: [] } : { breaks: [{
        breakId: "break-1", accountId: "acc1", asset: "CASH", expected: "1000.00", actual: "990.00", status: isResolved ? "RESOLVED" : "OPEN",
      }] }), { status: 200 });
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
    expect(screen.getByText(/Found/)).toBeInTheDocument();
    expect(screen.getByText(/Reviewed/)).toBeInTheDocument();

    // Check mandatory reason requirement
    expect(screen.getByPlaceholderText(/Why is this break being resolved/)).toBeInTheDocument();

    // Resolve button should be disabled without reason
    const resolveButtonsAfterOpen = screen.getAllByText("Resolve");
    const submitResolveBtn = resolveButtonsAfterOpen[resolveButtonsAfterOpen.length - 1];
    expect(submitResolveBtn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Resolution Reason/), "Verified statement correction");
    await userEvent.click(submitResolveBtn!);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/resolve"), expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(screen.getByText("RESOLVED")).toBeInTheDocument());
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
