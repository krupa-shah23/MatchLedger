/**
 * P2 Trading: symbol picker, book ladder, trades tape, order entry, open
 * orders, breaker banner, connection indicator. Live data via useSocket
 * (real stream-state.ts reducer); writes via OrderEntry -> POST /orders.
 * Tests: UP2-UP6.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider.js";
import { useCanWrite } from "../auth/guards.js";
import { useSocket, type SocketLike } from "../ws/useSocket.js";
import { OrderEntry } from "../components/OrderEntry.js";
import { OpenOrders } from "../components/OpenOrders.js";
import { Icon, PageHeading } from "../components/Ui.js";
import type { Order } from "../lib/lifecycle.js";
import { displayMoney } from "../utils/display-money.js";

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


export function TradingPage({
  wsUrl = import.meta.env.VITE_WS_URL ?? "/ws",
  apiBaseUrl = "/api/v1",
  createSocket,
}: {
  wsUrl?: string;
  apiBaseUrl?: string;
  createSocket?: (url: string) => SocketLike;
}) {
  const { token, client } = useAuth();
  const canWrite = useCanWrite("/trade");
  const [symbol, setSymbol] = useState("");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [instrumentsLoading, setInstrumentsLoading] = useState(true);
  const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    client.get<Array<{ symbol: string }>>("/instruments").then(instruments => {
      if (!active) return;
      const names = instruments.map(instrument => instrument.symbol);
      setSymbols(names);
      setSymbol(current => names.includes(current) ? current : names[0] ?? "");
    }).catch(error => { if (active) setInstrumentsError(error instanceof Error ? error.message : "Unable to load instruments"); })
      .finally(() => { if (active) setInstrumentsLoading(false); });
    return () => { active = false; };
  }, [client]);

  const topics = useMemo(() => [`book.${symbol}`, `trades.${symbol}`, "breaker", "user.orders"], [symbol]);
  const { state, connection } = useSocket({ url: wsUrl, token: symbol ? token : null, topics, onLogout: () => {}, createSocket });

  const bookTopic = state.topics[`book.${symbol}`];
  const tradesTopic = state.topics[`trades.${symbol}`];
  const breakerTopic = state.topics["breaker"];
  const ordersTopic = state.topics["user.orders"];

  const book = (bookTopic?.snapshot as BookSnapshot | undefined) ?? { bids: [], asks: [] };
  const trades = (tradesTopic?.snapshot as TradeTapeEntry[] | undefined) ?? [];
  const breakers = (breakerTopic?.snapshot as BreakerSnapshot[] | undefined) ?? [];
  const orders = (ordersTopic?.snapshot as Order[] | undefined) ?? [];

  const breaker = breakers.find((b) => b.symbol === symbol);
  const isHalted = breaker?.state === "OPEN";
  const isRecovering = breaker?.state === "HALF_OPEN";
  const isStale = connection === "stale" || [bookTopic, tradesTopic, breakerTopic, ordersTopic].some((t) => t?.status === "stale" || t?.status === "syncing");
  const isConflated = [bookTopic, tradesTopic].some((t) => t?.conflated);

  if (instrumentsError) return <div className="page"><div className="notice notice-error" role="alert">{instrumentsError}</div></div>;
  if (instrumentsLoading) return <div className="loading-state"><span className="spinner" aria-hidden="true" />Loading instruments...</div>;
  if (symbols.length === 0) return <div className="page"><p className="empty-state">No instruments configured</p></div>;
  return (
    <div className="page">
      <PageHeading title="Trading" eyebrow="MARKET WORKSPACE" description="Follow the book. Place an order. Track every outcome." actions={<ConnectionIndicator connection={connection} stale={isStale} conflated={isConflated} />} />
      <div className="toolbar"><label htmlFor="trading-symbol">Instrument</label><select id="trading-symbol" aria-label="Trading symbol" value={symbol} onChange={e => setSymbol(e.target.value)}>{symbols.map(s => <option key={s} value={s}>{s}</option>)}</select><span className="panel-note">Book and orders update over the live stream.</span></div>
      {isHalted && breaker && <div className="notice notice-error"><strong>Market halted</strong>: {breaker.tripReason ?? "reason unavailable"} (OPEN)</div>}
      {isRecovering && <div className="notice notice-warning"><strong>Market recovering</strong>: breaker is HALF_OPEN and applies its trial limits. New orders are still checked by the engine.</div>}
      <div className="trading-grid">
        <div className="trading-market"><BookLadder book={book} /><TradesTape trades={trades} /></div>
        {canWrite ? <OrderEntry symbol={symbol} apiBaseUrl={apiBaseUrl} marketHalted={isHalted} /> : <div className="panel"><p className="empty-state">Read-only: your role cannot place orders here.</p></div>}
      </div>
      <OpenOrders orders={orders} apiBaseUrl={apiBaseUrl} />
    </div>
  );
}

function BookLadder({ book }: { book: BookSnapshot }) {
  const asks = book.asks.slice(0, 10);
  const bids = book.bids.slice(0, 10);
  return <section className="panel"><div className="panel-heading"><h3>Book (Top 10)</h3><span className="panel-note">Price / quantity</span></div>{asks.length === 0 && bids.length === 0 ? <div className="empty-state"><Icon name="layers" /><p>No book data</p><small>Resting orders will appear here.</small></div> : <div className="book-columns">{[{ levels: bids, label: "BID", cls: "book-bids", colour: "text-buy" }, { levels: asks, label: "ASK", cls: "book-asks", colour: "text-sell" }].map(({ levels, label, cls, colour }) => <div key={label}><div className={`book-side-label ${colour}`}><span>{label}</span><span>{levels.length} levels</span></div><table className={`book-table ${cls}`} aria-label={`${label} order book`}><thead><tr><th>Price</th><th className="numeric">Quantity</th></tr></thead><tbody>{Array.from({ length: Math.max(5, bids.length, asks.length) }, (_, i) => <tr key={i}><td>{levels[i] ? displayMoney(levels[i][0]) : "—"}</td><td className="numeric">{levels[i]?.[1] ?? "—"}</td></tr>)}</tbody></table></div>)}</div>}</section>;
}

function TradesTape({ trades }: { trades: TradeTapeEntry[] }) {
  return <section className="panel"><div className="panel-heading"><h3>Recent Trades</h3><span className="panel-note">Execution tape</span></div>{trades.length === 0 ? <div className="empty-state"><p>No trades</p><small>Completed matches will appear here.</small></div> : <div className="table-scroll trade-tape"><table><thead><tr><th>Time</th><th className="numeric">Price</th><th className="numeric">Quantity</th><th>Side</th></tr></thead><tbody>{trades.map((trade, i) => <tr key={i}><td>{globalThis.isNaN(new Date(trade.ts).getTime()) ? trade.ts : new Date(trade.ts).toLocaleTimeString()}</td><td className={`numeric ${trade.takerSide === "BUY" ? "text-buy" : "text-sell"}`}>{displayMoney(trade.price)}</td><td className="numeric">{trade.quantity}</td><td><span className={`badge ${trade.takerSide === "BUY" ? "badge-good" : "badge-bad"}`}>{trade.takerSide}</span></td></tr>)}</tbody></table></div>}</section>;
}

function ConnectionIndicator({ connection, stale, conflated }: { connection: string; stale: boolean; conflated: boolean }) {
  const label = stale ? "Stale" : connection === "authenticated" ? "Connected" : "Connecting";
  return <span className={`badge ${stale ? "badge-warn" : connection === "authenticated" ? "badge-good" : "badge-neutral"}`} role="status"><span className="status-dot" />{label}{conflated && " (conflated)"}</span>;
}
