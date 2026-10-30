/**
 * P2 Trading: symbol picker, book ladder, trades tape, order entry, open
 * orders, breaker banner, connection indicator. Live data via useSocket
 * (real stream-state.ts reducer); writes via OrderEntry -> POST /orders.
 * Tests: UP2-UP6.
 */
import React, { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.js";
import { useSocket, type SocketLike } from "../ws/useSocket.js";
import { OrderEntry } from "../components/OrderEntry.js";
import { OpenOrders } from "../components/OpenOrders.js";
import type { Order } from "../lib/lifecycle.js";

export interface BookSnapshot {
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
}

export interface TradeTapeEntry {
  price: string;
  quantity: string;
  ts: string;
  takerSide: "BUY" | "SELL";
}

export interface BreakerSnapshot {
  symbol: string;
  state: "CLOSED" | "HALF_OPEN" | "OPEN";
  tripReason?: string | null;
}

const DEFAULT_SYMBOLS = ["ACME", "BOBO"];

export function TradingPage({
  wsUrl = "/ws",
  apiBaseUrl = "/api/v1",
  createSocket,
}: {
  wsUrl?: string;
  apiBaseUrl?: string;
  createSocket?: (url: string) => SocketLike;
}) {
  const { token, user } = useAuth();
  const [symbol, setSymbol] = useState<string>(DEFAULT_SYMBOLS[0] ?? "ACME");

  const topics = useMemo(() => [`book.${symbol}`, `trades.${symbol}`, "breaker", "user.orders"], [symbol]);
  const { state, connection } = useSocket({ url: wsUrl, token, topics, onLogout: () => {}, createSocket });

  const bookTopic = state.topics[`book.${symbol}`];
  const tradesTopic = state.topics[`trades.${symbol}`];
  const breakerTopic = state.topics["breaker"];
  const ordersTopic = state.topics["user.orders"];

  const book = (bookTopic?.snapshot as BookSnapshot | undefined) ?? { bids: [], asks: [] };
  const trades = (tradesTopic?.snapshot as TradeTapeEntry[] | undefined) ?? [];
  const breakers = (breakerTopic?.snapshot as BreakerSnapshot[] | undefined) ?? [];
  const orders = (ordersTopic?.snapshot as Order[] | undefined) ?? [];

  const breaker = breakers.find((b) => b.symbol === symbol);
  const isHalted = breaker && breaker.state !== "CLOSED";
  const isStale = connection === "stale" || [bookTopic, tradesTopic, breakerTopic, ordersTopic].some((t) => t?.status === "stale" || t?.status === "syncing");
  const isConflated = [bookTopic, tradesTopic].some((t) => t?.conflated);

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Trading</h1>
        <ConnectionIndicator connection={connection} stale={isStale} conflated={isConflated} />
      </div>

      <div>
        <label>Symbol: </label>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {DEFAULT_SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isHalted && breaker && (
        <div style={{ backgroundColor: "#ffcccc", border: "2px solid red", padding: 12, borderRadius: 4 }}>
          <strong>Market halted</strong>: {breaker.tripReason ?? "no reason given"} ({breaker.state})
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div>
          <BookLadder book={book} />
          <TradesTape trades={trades} />
        </div>
        <div>
          {user?.role === "TRADER" ? (
            <OrderEntry symbol={symbol} apiBaseUrl={apiBaseUrl} />
          ) : (
            <div style={{ padding: 20, color: "#999" }}>Read-only: your role cannot place orders here.</div>
          )}
        </div>
      </div>

      <OpenOrders orders={orders} apiBaseUrl={apiBaseUrl} />
    </div>
  );
}

function BookLadder({ book }: { book: BookSnapshot }) {
  const asks = book.asks.length > 0 ? book.asks.slice(0, 10) : [];
  const bids = book.bids.length > 0 ? book.bids.slice(0, 10) : [];

  return (
    <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 10 }}>
      <h3>Book (Top 10)</h3>
      {asks.length === 0 && bids.length === 0 ? (
        <p style={{ color: "#999" }}>No book data</p>
      ) : (
        <table style={{ width: "100%", fontSize: 12 }}>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => {
              const ask = asks[9 - i];
              return (
                <tr key={`ask-${i}`}>
                  <td>{ask ? ask[0] : "—"}</td>
                  <td>{ask ? ask[1] : "—"}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={2} style={{ textAlign: "center", fontWeight: "bold" }}>
                Spread
              </td>
            </tr>
            {Array.from({ length: 10 }).map((_, i) => {
              const bid = bids[i];
              return (
                <tr key={`bid-${i}`}>
                  <td>{bid ? bid[0] : "—"}</td>
                  <td>{bid ? bid[1] : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TradesTape({ trades }: { trades: TradeTapeEntry[] }) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 10 }}>
      <h3>Recent Trades</h3>
      {trades.length === 0 ? (
        <p style={{ color: "#999" }}>No trades</p>
      ) : (
        <table style={{ width: "100%", fontSize: 12 }}>
          <tbody>
            {trades.map((t, i) => (
              <tr key={i} style={{ backgroundColor: t.takerSide === "BUY" ? "#f0f0ff" : "#fff0f0" }}>
                <td>{t.ts}</td>
                <td>{t.price}</td>
                <td>{t.quantity}</td>
                <td>{t.takerSide}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ConnectionIndicator({ connection, stale, conflated }: { connection: string; stale: boolean; conflated: boolean }) {
  const label = stale ? "Stale" : connection === "authenticated" ? "Connected" : "Connecting";
  const color = stale ? "orange" : connection === "authenticated" ? "green" : "#999";
  return (
    <div style={{ padding: "8px 12px", backgroundColor: color, color: "white", borderRadius: 4, fontSize: 12 }}>
      {label}
      {conflated && " (conflated)"}
    </div>
  );
}
