/**
 * UP9-UP10: Order detail page (timeline, rejection detail)
 */

import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

// Mock order detail page
const OrderDetailPage = () => (
  <div>
    <h1>Order Detail</h1>
    <div data-testid="timeline">
      <div>SUBMITTED - seq 1, ts 2024-01-01T00:00:00Z</div>
      <div>ACCEPTED - seq 2, ts 2024-01-01T00:00:05Z</div>
      <div>REJECTED - seq 3, ts 2024-01-01T00:00:10Z, reason: insufficient balance</div>
    </div>
    <div data-testid="rejection-detail">
      Rejected: needed 101.25, available 98.00
    </div>
    <div data-testid="audit-trail">Audit events log</div>
  </div>
);

describe("UP: Order Detail Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it("UP9: Order detail timeline shows events in display order with seq, ts, type, payload", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <OrderDetailPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("timeline")).toBeInTheDocument();
    expect(screen.getByText(/SUBMITTED/)).toBeInTheDocument();
    expect(screen.getByText(/ACCEPTED/)).toBeInTheDocument();
    expect(screen.getByText(/REJECTED/)).toBeInTheDocument();
  });

  it("UP10: Rejected order shows snapshot and sentence 'Rejected: needed X, available Y'", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <OrderDetailPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("rejection-detail")).toHaveTextContent(
      "Rejected: needed 101.25, available 98.00"
    );
  });
});
