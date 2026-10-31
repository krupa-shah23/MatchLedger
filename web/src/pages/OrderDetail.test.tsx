/**
 * UP9-UP10: Order detail page, against the real OrderDetailPage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider.js";
import { OrderDetailPage } from "./OrderDetail.js";

function renderOrderDetail(orderId: string) {
  sessionStorage.setItem("authToken", "tok");
  sessionStorage.setItem("authUser", JSON.stringify({ id: "u1", username: "t1", role: "TRADER", accountIds: ["a1"] }));
  render(
    <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("UP: Order Detail Page", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("UP9: timeline shows events in display order with seq, ts, type, payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/events")) {
          return new Response(
            JSON.stringify([
              { seq: 1, ts: new Date().toISOString(), type: "PlaceOrder", payload: { symbol: "AAPL" } },
              { seq: 2, ts: new Date().toISOString(), type: "OrderAccepted", payload: {} },
            ]),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            id: "ord-1",
            symbol: "AAPL",
            side: "BUY",
            type: "LIMIT",
            quantity: "100",
            filledQty: "0",
            price: "1500000.00",
            status: "ACCEPTED",
            createdAt: new Date().toISOString(),
          }),
          { status: 200 }
        );
      })
    );

    renderOrderDetail("ord-1");

    await waitFor(() => expect(screen.getByText("PlaceOrder")).toBeInTheDocument());
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("OrderAccepted")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("UP10: a rejected order shows the account snapshot and the exact sentence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/events")) {
          return new Response(
            JSON.stringify([
              { seq: 1, ts: new Date().toISOString(), type: "PlaceOrder", payload: {} },
              { seq: 2, ts: new Date().toISOString(), type: "OrderRejected", payload: { needed: "101.25", available: "98.00" } },
            ]),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            id: "ord-2",
            symbol: "AAPL",
            side: "BUY",
            type: "LIMIT",
            quantity: "1",
            filledQty: "0",
            price: "101.25",
            status: "REJECTED",
            terminalReason: "INSUFFICIENT_BALANCE",
            createdAt: new Date().toISOString(),
          }),
          { status: 200 }
        );
      })
    );

    renderOrderDetail("ord-2");

    await waitFor(() => expect(screen.getByText(/Rejected: needed/)).toBeInTheDocument());
    expect(screen.getByText("Rejected: needed ₹101.25, available ₹98.00")).toBeInTheDocument();
  });

  it("a 404 from the server renders a not-found page, not a crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ code: "not_found", detail: "Order not found" }), { status: 404 }))
    );

    renderOrderDetail("missing-order");

    await waitFor(() => expect(screen.getByText("Order Not Found")).toBeInTheDocument());
  });
});
