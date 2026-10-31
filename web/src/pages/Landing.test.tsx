import { describe, expect, it } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "./Landing.js";

describe("MatchLedger landing page", () => {
  it("explains the order lifecycle and links into existing sign-in and demo access", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: /Orders & Ledgers/ })).toBeInTheDocument();
    expect(screen.queryByText(/TRADING INFRASTRUCTURE, MADE VISIBLE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Every accepted outcome reaches an auditable ledger/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open workspace/ })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /Explore demo roles/ })).toHaveAttribute("href", "/login#demo-access");
    expect(screen.getByRole("group", { name: /order flow orbit/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reconcile" })).toBeInTheDocument();
  });
});
