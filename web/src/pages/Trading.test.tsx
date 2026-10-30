/**
 * UP2-UP6: Trading page (ladder, tape, entry, book updates, breaker banner),
 * against the real TradingPage with a fake socket (no network).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../auth/AuthProvider.js";
import { TradingPage } from "./Trading.js";
import type { SocketLike } from "../ws/useSocket.js";

class FakeSocket implements SocketLike {
  public sent: string[] = [];
  private listeners: Record<string, Array<(e: { data?: string; code?: number }) => void>> = {};
  addEventListener(type: string, listener: (e: { data?: string; code?: number }) => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
  emit(type: string, event: { data?: string; code?: number }) {
    for (const l of this.listeners[type] ?? []) l(event);
  }
}

function renderTrading(role: "TRADER" | "ADMIN" = "TRADER") {
  sessionStorage.setItem("authToken", "tok");
  sessionStorage.setItem("authUser", JSON.stringify({ id: "u1", username: "t1", role, accountIds: ["a1"] }));

  const sockets: FakeSocket[] = [];
  render(
    <MemoryRouter>
      <AuthProvider>
        <TradingPage
          createSocket={() => {
            const s = new FakeSocket();
            sockets.push(s);
            return s;
          }}
        />
      </AuthProvider>
    </MemoryRouter>
  );
  return sockets;
}

async function authenticate(sockets: FakeSocket[]) {
  await waitFor(() => expect(sockets).toHaveLength(1));
  act(() => sockets[0]!.emit("message", { data: JSON.stringify({ type: "auth.ok" }) }));
  return sockets[0]!;
}

describe("UP: Trading Page", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("UP2: loads with ladder, tape, entry, open orders rendered from snapshots (empty state, not blank)", async () => {
    const sockets = renderTrading();
    await authenticate(sockets);

    expect(screen.getByText("Book (Top 10)")).toBeInTheDocument();
    expect(screen.getByText("Recent Trades")).toBeInTheDocument();
    expect(screen.getByText("Order Entry")).toBeInTheDocument();
    expect(screen.getByText("No book data")).toBeInTheDocument();
    expect(screen.getByText("No trades")).toBeInTheDocument();
    expect(screen.getByText("No open orders")).toBeInTheDocument();
  });

  it("UP3: a book.* snapshot populates the ladder; a trades.* snapshot populates the tape", async () => {
    const sockets = renderTrading();
    const socket = await authenticate(sockets);

    act(() => {
      socket.emit("message", {
        data: JSON.stringify({
          type: "snapshot",
          topic: "book.ACME",
          epoch: 1,
          seq: 1,
          data: { bids: [["100", "10"]], asks: [["101", "5"]] },
        }),
      });
      socket.emit("message", {
        data: JSON.stringify({
          type: "snapshot",
          topic: "trades.ACME",
          epoch: 1,
          seq: 1,
          data: [{ price: "100", quantity: "10", ts: "12:00", takerSide: "BUY" }],
        }),
      });
    });

    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getAllByText("100")[0]).toBeInTheDocument();
  });

  it("UP4: user.orders snapshot renders an open order in OpenOrders with its lifecycle strip", async () => {
    const sockets = renderTrading();
    const socket = await authenticate(sockets);

    act(() => {
      socket.emit("message", {
        data: JSON.stringify({
          type: "snapshot",
          topic: "user.orders",
          epoch: 1,
          seq: 1,
          data: [
            {
              id: "ord-1",
              symbol: "ACME",
              side: "BUY",
              quantity: "10",
              filledQty: "0",
              status: "RESTING",
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    expect(screen.getByText("resting in the book")).toBeInTheDocument();
  });

  it("UP5: breaker snapshot with a halted symbol shows the banner with its reason", async () => {
    const sockets = renderTrading();
    const socket = await authenticate(sockets);

    act(() => {
      socket.emit("message", {
        data: JSON.stringify({
          type: "snapshot",
          topic: "breaker",
          epoch: 1,
          seq: 1,
          data: [{ symbol: "ACME", state: "OPEN", tripReason: "volatility" }],
        }),
      });
    });

    expect(screen.getByText(/Market halted/)).toBeInTheDocument();
    expect(screen.getByText(/volatility/)).toBeInTheDocument();
  });

  it("UP6: connection indicator shows stale after a disconnect, and the conflated badge on a conflated snapshot", async () => {
    const sockets = renderTrading();
    const socket = await authenticate(sockets);

    expect(screen.getByText("Connected")).toBeInTheDocument();

    act(() => {
      socket.emit("message", {
        data: JSON.stringify({ type: "snapshot", topic: "book.ACME", epoch: 1, seq: 1, conflated: true, data: { bids: [], asks: [] } }),
      });
    });
    expect(screen.getByText(/conflated/)).toBeInTheDocument();

    act(() => socket.emit("close", { code: 1001 }));
    await waitFor(() => expect(screen.getByText(/Stale/)).toBeInTheDocument());
  });

  it("ADMIN is read-only on the trading page (no order entry form)", async () => {
    const sockets = renderTrading("ADMIN");
    await authenticate(sockets);

    expect(screen.queryByText("Order Entry")).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
