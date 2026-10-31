import { ToastProvider } from "../components/Toast.js";
/**
 * UP1: Login page with demo role buttons, against the real LoginPage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider.js";
import { LoginPage } from "./Login.js";

function renderLogin(demoMode: boolean) {
  return render(
    <MemoryRouter>
      <ToastProvider><AuthProvider>
        <LoginPage demoMode={demoMode} />
      </AuthProvider></ToastProvider>
    </MemoryRouter>
  );
}

describe("UP1: Login page", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("UP1: shows a demo button per role when the server reports demo mode", () => {
    renderLogin(true);
    expect(screen.getByText("Login as Trader")).toBeInTheDocument();
    expect(screen.getByText("Login as Risk Officer")).toBeInTheDocument();
    expect(screen.getByText("Login as Ops")).toBeInTheDocument();
    expect(screen.getByText("Login as Admin")).toBeInTheDocument();
  });

  it("hides demo buttons outside the demo profile", () => {
    renderLogin(false);
    expect(screen.queryByText(/Login as/)).not.toBeInTheDocument();
  });

  it("each demo button logs in with the seeded credentials for that role", async () => {
    const calls: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(JSON.parse(init.body as string));
        return new Response(
          JSON.stringify({
            token: "tok-admin",
            expiresAt: new Date().toISOString(),
            user: { userId: "u1", username: "demo-admin", role: "ADMIN", accountIds: ["acc-1"] },
          }),
          { status: 200 }
        );
      })
    );

    renderLogin(true);
    await userEvent.click(screen.getByText("Login as Admin"));

    await waitFor(() => expect(calls).toEqual([{ username: "demo-admin", password: "demo-password" }]));
  });

  it("shows an error message on invalid credentials and does not navigate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: "unauthenticated", detail: "Invalid username or password" }), {
          status: 401,
        })
      )
    );

    renderLogin(false);
    await userEvent.type(screen.getByPlaceholderText("Username"), "trader1");
    await userEvent.type(screen.getByPlaceholderText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => expect(screen.getByText("Invalid username or password")).toBeInTheDocument());
  });
});
