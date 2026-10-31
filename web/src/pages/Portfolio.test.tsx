/**
 * UP7-UP8: Portfolio page, against the real PortfolioPage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider.js";
import { PortfolioPage } from "./Portfolio.js";

function renderPortfolio(role: "TRADER" | "RISK" = "TRADER") {
  sessionStorage.setItem("authToken", "tok");
  sessionStorage.setItem("authUser", JSON.stringify({ id: "u1", username: "t1", role, accountIds: ["acc-1"] }));
  render(
    <MemoryRouter>
      <AuthProvider>
        <PortfolioPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("UP: Portfolio Page", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("UP7: shows cash card, held-by-symbol, positions, and reservations from real endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/balances")) {
          return new Response(
            JSON.stringify({ cash: "5000000.00", heldCash: "1500000.00", available: "3500000.00", heldBy: { AAPL: "Open order" } }),
            { status: 200 }
          );
        }
        if (url.includes("/positions")) {
          return new Response(
            JSON.stringify([{ symbol: "AAPL", quantity: "500", costBasis: "1500000.00", mark: "155000000", unrealizedPnL: "2500000", realizedPnl: "5000.00" }]),
            { status: 200 }
          );
        }
        if (url.includes("/reservations")) {
          return new Response(JSON.stringify([{ orderId: "res-1", symbol: "NVDA", asset: "CASH", amountRemaining: "750000.00" }]), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      })
    );

    renderPortfolio();

    await waitFor(() => expect(screen.getByText("Cash")).toBeInTheDocument());
    expect(screen.getByText("Held By Position")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("Reservations")).toBeInTheDocument();
  });

  it("UP8: a null mark renders an em dash for both mark and unrealized P&L, never 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/balances")) return new Response(JSON.stringify({ cash: "0.00", heldCash: "0.00", available: "0.00" }), { status: 200 });
        if (url.includes("/positions")) {
          return new Response(
            JSON.stringify([{ symbol: "TSLA", quantity: "100", costBasis: "2000000.00", mark: null, unrealizedPnL: null, realizedPnl: "-10000.00" }]),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify([]), { status: 200 });
      })
    );

    renderPortfolio();

    await waitFor(() => expect(screen.getByText("TSLA")).toBeInTheDocument());
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(2); // mark and unrealized P&L
  });

  it("RISK must pick an account before the portfolio loads", () => {
    sessionStorage.setItem("authToken", "tok");
    sessionStorage.setItem("authUser", JSON.stringify({ id: "u1", username: "r1", role: "RISK", accountIds: [] }));
    render(
      <MemoryRouter>
        <AuthProvider>
          <PortfolioPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Pick an account/)).toBeInTheDocument();
  });

  it("empty account shows 0.00 balances, never blank or null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/balances")) return new Response(JSON.stringify({ cash: "0.00", heldCash: "0.00", available: "0.00" }), { status: 200 });
        return new Response(JSON.stringify([]), { status: 200 });
      })
    );

    renderPortfolio();

    await waitFor(() => expect(screen.getByText("Cash")).toBeInTheDocument());
    expect(screen.getByText("No positions")).toBeInTheDocument();
    expect(screen.getAllByText(/₹0\.00/).length).toBeGreaterThan(0);
  });
});
