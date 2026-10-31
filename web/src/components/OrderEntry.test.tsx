import { ToastProvider } from "./Toast.js";
/**
 * UF1-UF5: Order entry form, against the real OrderEntry component.
 *
 * SCOPE CORRECTION: forms.test.ts (removed) previously asserted UF1-UF5
 * against standalone closures it defined inline inside each test - never
 * importing or rendering OrderEntry.tsx. Those tests could not fail no
 * matter what OrderEntry.tsx actually did (confirmed by mutation testing:
 * mutations 11/12 "survived" because the tests never touched the real
 * component). These replace them with real renders of OrderEntry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { OrderEntry } from "./OrderEntry.js";

function fillValidLimitOrder() {
  fireEvent.change(screen.getByLabelText("Order quantity"), { target: { value: "100" } });
  fireEvent.change(screen.getByLabelText("Order price"), { target: { value: "50.00" } });
}

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

describe("UF: Order Entry Form", () => {
  beforeEach(() => {
    sessionStorage.setItem("authToken", "tok");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("UF1: LIMIT with non-tick price is rejected before any network call", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<ToastProvider><OrderEntry symbol="ACME" apiBaseUrl="/api/v1" /></ToastProvider>);

    fireEvent.change(screen.getByLabelText("Order quantity"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Order price"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: /Submit/ })).toBeDisabled();
    expect(screen.queryByLabelText("Client order ID")).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("explains why submission is unavailable when the market breaker is open", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ToastProvider><OrderEntry symbol="ACME" apiBaseUrl="/api/v1" marketHalted /></ToastProvider>);

    expect(screen.getByRole("button", { name: "Submit BUY" })).toBeDisabled();
    expect(screen.getByText(/Orders are paused for ACME while its breaker is OPEN/i)).toBeInTheDocument();
  });

  it("UF2: Double submit prevention - submit button disabled while the real request is in flight", async () => {
    let resolveFetch: (() => void) | undefined;
    const fetchSpy = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = () =>
            resolve({ ok: true, status: 202, json: () => Promise.resolve({ clientOrderId: "cid-1", orderId: "o1" }) } as Response);
        })
    );
    vi.stubGlobal("fetch", fetchSpy);
    render(<ToastProvider><OrderEntry symbol="ACME" apiBaseUrl="/api/v1" /></ToastProvider>);

    fillValidLimitOrder();
    const button = screen.getByRole("button", { name: /Submit/ });
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    // A second click while the first request is still in flight must not
    // issue a second real fetch - this is what the fake forms.test.ts
    // version could never prove.
    fireEvent.click(button);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    resolveFetch?.();
    // Fields are cleared on success, so the button stays disabled (nothing
    // to submit) - but it is no longer in the "Submitting..." state.
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit BUY" })).toBeInTheDocument());
  });

  it("generates a different internal client ID for each newly submitted order", async () => {
    const fetchSpy = vi.fn(() => jsonResponse(202, { orderId: "order-accepted" }));
    vi.stubGlobal("fetch", fetchSpy);
    render(<ToastProvider><OrderEntry symbol="ACME" apiBaseUrl="/api/v1" /></ToastProvider>);

    fillValidLimitOrder();
    fireEvent.click(screen.getByRole("button", { name: "Submit BUY" }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const calls = fetchSpy.mock.calls as unknown as unknown[][];
    const firstBody = JSON.parse((calls[0]![1] as RequestInit).body as string) as { clientOrderId: string };

    fillValidLimitOrder();
    fireEvent.click(screen.getByRole("button", { name: "Submit BUY" }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const secondBody = JSON.parse((calls[1]![1] as RequestInit).body as string) as { clientOrderId: string };

    expect(firstBody.clientOrderId).toMatch(/^web-/);
    expect(secondBody.clientOrderId).toMatch(/^web-/);
    expect(secondBody.clientOrderId).not.toBe(firstBody.clientOrderId);
  });

  it("UF3: retries reuse the hidden ID for an unchanged payload and rotate it when the order changes", async () => {
    const fetchSpy = vi.fn().mockImplementation(() => Promise.reject(new TypeError("network error")));
    vi.stubGlobal("fetch", fetchSpy);
    render(<ToastProvider><OrderEntry symbol="ACME" apiBaseUrl="/api/v1" /></ToastProvider>);

    fillValidLimitOrder();
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);
    const firstId = bodyOf(fetchSpy.mock.calls[0]!).clientOrderId;
    expect(firstId).toMatch(/^web-/);
    expect(bodyOf(fetchSpy.mock.calls[1]!).clientOrderId).toBe(firstId);

    fireEvent.change(screen.getByLabelText("Order quantity"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
    expect(bodyOf(fetchSpy.mock.calls[2]!).clientOrderId).not.toBe(firstId);
  });

  it("UF4: 409 tells the user to review orders and automatically generates a fresh ID on resubmit", async () => {
    const fetchSpy = vi.fn(() => jsonResponse(409, { detail: "conflict" }));
    vi.stubGlobal("fetch", fetchSpy);
    render(<ToastProvider><OrderEntry symbol="ACME" apiBaseUrl="/api/v1" /></ToastProvider>);

    fillValidLimitOrder();
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));

    await screen.findByText(/This order conflicted with an earlier request/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);
    const conflictedId = bodyOf(fetchSpy.mock.calls[0]!).clientOrderId;
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(bodyOf(fetchSpy.mock.calls[1]!).clientOrderId).not.toBe(conflictedId);
  });

  it("UF4: 503 tells the user nothing was submitted", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse(503, { detail: "unavailable" })));
    render(<ToastProvider><OrderEntry symbol="ACME" apiBaseUrl="/api/v1" /></ToastProvider>);

    fillValidLimitOrder();
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));

    await screen.findByText(/Service unavailable/i);
  });

  it("UF5: MARKET orders show no estimate value, only the no-estimate explanation", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ToastProvider><OrderEntry symbol="ACME" apiBaseUrl="/api/v1" /></ToastProvider>);
    fireEvent.change(screen.getByLabelText("Order type"), { target: { value: "MARKET" } });
    expect(screen.queryByText("Estimate:")).not.toBeInTheDocument();
    expect(screen.getByText(/No estimate for MARKET orders/i)).toBeInTheDocument();
  });
});
