/**
 * P2: Trading page with symbol picker, book ladder, trades tape, connection indicator.
 * Tests: UP2, UP3, UP5, UP6
 */

import React, { useState } from "react";

interface Symbol {
  symbol: string;
  displayName: string;
  breaker?: { state: "OPEN" | "HALTED"; reason?: string };
}

const DEMO_SYMBOLS: Symbol[] = [
  { symbol: "AAPL", displayName: "Apple Inc.", breaker: { state: "OPEN" } },
  { symbol: "MSFT", displayName: "Microsoft Corp.", breaker: { state: "OPEN" } },
  { symbol: "TSLA", displayName: "Tesla Inc.", breaker: { state: "HALTED", reason: "Circuit breaker triggered" } },
  { symbol: "NVDA", displayName: "NVIDIA Corp.", breaker: { state: "OPEN" } },
];

const DEMO_BOOK = {
  bids: [
    ["150000000", "1000"],
    ["149900000", "2000"],
    ["149800000", "1500"],
  ],
  asks: [
    ["150100000", "1200"],
    ["150200000", "1800"],
    ["150300000", "900"],
  ],
};

const DEMO_TRADES = [
  { price: "150000000", qty: "100", time: "14:32:15", side: "BUY" as const },
  { price: "149950000", qty: "250", time: "14:32:10", side: "SELL" as const },
  { price: "150000000", qty: "75", time: "14:32:05", side: "BUY" as const },
];

interface ConnectionState {
  connected: boolean;
  stale: boolean;
  conflated: boolean;
}

export function TradingPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<Symbol>(DEMO_SYMBOLS[0]);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: true,
    stale: false,
    conflated: false,
  });

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Trading</h1>
        <ConnectionIndicator state={connectionState} />
      </div>

      <SymbolPicker
        symbols={DEMO_SYMBOLS}
        selected={selectedSymbol}
        onSelect={setSelectedSymbol}
      />

      {selectedSymbol.breaker?.state === "HALTED" && (
        <BreakerBanner
          reason={selectedSymbol.breaker.reason || "Market halted"}
          incidentMs={30000}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div>
          <BookLadder book={DEMO_BOOK} />
          <TradesTape trades={DEMO_TRADES} />
        </div>
        <div style={{ border: "1px solid #ddd", padding: 10, borderRadius: 4 }}>
          <h3>Order Entry</h3>
          <p>(OrderEntry component P3)</p>
        </div>
      </div>
    </div>
  );
}

function SymbolPicker({
  symbols,
  selected,
  onSelect,
}: {
  symbols: Symbol[];
  selected: Symbol;
  onSelect: (s: Symbol) => void;
}) {
  return (
    <div>
      <label>Symbol: </label>
      <select value={selected.symbol} onChange={(e) => onSelect(symbols.find(s => s.symbol === e.target.value)!)}>
        {symbols.map((s) => (
          <option key={s.symbol} value={s.symbol}>
            {s.symbol} - {s.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}

function BookLadder({ book }: { book: { bids: [string, string][]; asks: [string, string][] } }) {
  const midPrice = book.bids[0] && book.asks[0]
    ? ((BigInt(book.bids[0][0]) + BigInt(book.asks[0][0])) / 2n).toString()
    : "N/A";

  return (
    <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 10 }}>
      <h3>Book (Top 10)</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
        <div>
          <strong>Ask Price</strong>
          {book.asks.map((ask, i) => (
            <div key={i}>{ask[0]}</div>
          ))}
        </div>
        <div>
          <strong>Qty</strong>
          {book.asks.map((ask, i) => (
            <div key={i}>{ask[1]}</div>
          ))}
        </div>
        <div>
          <strong>Depth</strong>
          {book.asks.map((ask, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#ffcccc",
                width: `${(Number(ask[1]) / 2000) * 100}%`,
              }}
            >
              {" "}
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "center", fontWeight: "bold", margin: "5px 0" }}>
        Spread
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
        <div>
          <strong>Bid Price</strong>
          {book.bids.map((bid, i) => (
            <div key={i}>{bid[0]}</div>
          ))}
        </div>
        <div>
          <strong>Qty</strong>
          {book.bids.map((bid, i) => (
            <div key={i}>{bid[1]}</div>
          ))}
        </div>
        <div>
          <strong>Depth</strong>
          {book.bids.map((bid, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#ccffcc",
                width: `${(Number(bid[1]) / 2000) * 100}%`,
              }}
            >
              {" "}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TradesTape({ trades }: { trades: Array<{ price: string; qty: string; time: string; side: "BUY" | "SELL" }> }) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 10 }}>
      <h3>Recent Trades</h3>
      {trades.length === 0 ? (
        <p>No trades</p>
      ) : (
        <table style={{ width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Side</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => (
              <tr key={i} style={{ backgroundColor: t.side === "BUY" ? "#f0f0ff" : "#fff0f0" }}>
                <td>{t.time}</td>
                <td>{t.price}</td>
                <td>{t.qty}</td>
                <td>{t.side}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ConnectionIndicator({ state }: { state: ConnectionState }) {
  const statusColor = state.connected ? "green" : state.stale ? "orange" : "red";
  const statusText = state.connected ? "Connected" : state.stale ? "Stale" : "Disconnected";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        backgroundColor: statusColor,
        color: "white",
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          backgroundColor: "white",
          borderRadius: "50%",
        }}
      />
      {statusText}
      {state.conflated && " (conflated)"}
    </div>
  );
}

function BreakerBanner({ reason, incidentMs }: { reason: string; incidentMs: number }) {
  const [elapsedMs, setElapsedMs] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMs((e) => (e + 1000 < incidentMs ? e + 1000 : incidentMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [incidentMs]);

  const remainingS = Math.ceil((incidentMs - elapsedMs) / 1000);

  return (
    <div
      style={{
        backgroundColor: "#ffcccc",
        border: "2px solid red",
        padding: 12,
        borderRadius: 4,
      }}
    >
      <strong>⚠ Market Halted</strong>: {reason} — Resume in {remainingS}s
    </div>
  );
}
