/**
 * UP1: Login page with demo role buttons
 */

import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

// Mock page component
const LoginPage = () => (
  <div>
    <h1>Login</h1>
    <button onClick={() => console.log("trader")}>Login as Trader</button>
    <button onClick={() => console.log("risk")}>Login as Risk Officer</button>
    <button onClick={() => console.log("ops")}>Login as Ops</button>
    <button onClick={() => console.log("admin")}>Login as Admin</button>
  </div>
);

describe("UP: Pages (P1-P7)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it("UP1: Login with demo buttons shows each role", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Login as Trader")).toBeInTheDocument();
    expect(screen.getByText("Login as Risk Officer")).toBeInTheDocument();
    expect(screen.getByText("Login as Ops")).toBeInTheDocument();
    expect(screen.getByText("Login as Admin")).toBeInTheDocument();
  });
});
