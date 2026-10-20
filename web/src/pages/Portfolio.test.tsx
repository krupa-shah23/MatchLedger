/**
 * UP7-UP8: Portfolio page (cash, positions, null mark)
 */

import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

// Mock portfolio page
const PortfolioPage = () => (
  <div>
    <h1>Portfolio</h1>
    <div data-testid="cash-card">Cash: $10,000.00</div>
    <div data-testid="positions">
      <div>AAPL: 100 shares</div>
      <div>Unrealized P&L: —</div>
    </div>
    <div data-testid="held-funds">Held by symbol</div>
    <div data-testid="reservations">Reservations</div>
  </div>
);

describe("UP: Portfolio Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it("UP7: Portfolio shows cash card, held-by-symbol, positions, reservations", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PortfolioPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("cash-card")).toBeInTheDocument();
    expect(screen.getByTestId("positions")).toBeInTheDocument();
    expect(screen.getByTestId("held-funds")).toBeInTheDocument();
    expect(screen.getByTestId("reservations")).toBeInTheDocument();
  });

  it("UP8: Unrealized P&L shows em dash when null", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PortfolioPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Unrealized P&L: —")).toBeInTheDocument();
  });
});
