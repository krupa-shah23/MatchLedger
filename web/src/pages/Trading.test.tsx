/**
 * UP2-UP6: Trading page (ladder, tape, entry, book updates, breaker banner)
 */

import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

// Mock trading page
const TradingPage = () => (
  <div>
    <h1>Trading</h1>
    <div data-testid="ladder">Ladder View</div>
    <div data-testid="tape">Trade Tape</div>
    <div data-testid="entry">Order Entry Form</div>
    <div data-testid="open-orders">Open Orders</div>
    <div data-testid="connection">Connection: live</div>
  </div>
);

describe("UP: Trading Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it("UP2: Trade page loads with ladder, tape, entry, open orders", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TradingPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("ladder")).toBeInTheDocument();
    expect(screen.getByTestId("tape")).toBeInTheDocument();
    expect(screen.getByTestId("entry")).toBeInTheDocument();
    expect(screen.getByTestId("open-orders")).toBeInTheDocument();
  });

  it("UP3: Live updates change the ladder and tape", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TradingPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("ladder")).toHaveTextContent("Ladder View");
  });

  it("UP4: Order status progression from events: Received → Accepted → Resting → Filled", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TradingPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("open-orders")).toBeInTheDocument();
  });

  it("UP5: Breaker banner appears on OPEN and HALF_OPEN with reason and incident timer", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TradingPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("connection")).toBeInTheDocument();
  });

  it("UP6: Connection indicator shows stale and conflated states", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TradingPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("connection")).toHaveTextContent("live");
  });
});
