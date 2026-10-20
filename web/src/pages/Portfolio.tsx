/**
 * P3: Portfolio page with cash, positions, reservations.
 * Account picker first for RISK, OPS, ADMIN roles.
 * Tests: UP7, UP8
 */

import React, { useState } from "react";

interface Account {
  id: string;
  name: string;
}

interface Position {
  symbol: string;
  quantity: string;
  avgCost: string;
  mark: string | null;
  unrealizedPnL: string;
  realizedPnL: string;
}

interface Reservation {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: string;
  estimate: string;
}

interface PortfolioData {
  cash: {
    total: string;
    held: string;
    available: string;
  };
  heldBy: Record<string, string>; // symbol -> reason
  positions: Position[];
  reservations: Reservation[];
}

interface PortfolioPageProps {
  accounts?: Account[];
  userRole?: string;
  onAccountSelect?: (accountId: string) => void;
}

export function PortfolioPage({ accounts, userRole, onAccountSelect }: PortfolioPageProps) {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts?.[0]?.id || "");

  // Mock data for demo
  const demoData: PortfolioData = {
    cash: {
      total: "500000000", // $5M
      held: "150000000", // $1.5M
      available: "350000000", // $3.5M
    },
    heldBy: {
      AAPL: "Open order for 100 shares",
      MSFT: "Reservation",
    },
    positions: [
      {
        symbol: "AAPL",
        quantity: "500",
        avgCost: "150000000",
        mark: "155000000",
        unrealizedPnL: "2500000",
        realizedPnL: "500000",
      },
      {
        symbol: "TSLA",
        quantity: "100",
        avgCost: "200000000",
        mark: null,
        unrealizedPnL: "0",
        realizedPnL: "-1000000",
      },
    ],
    reservations: [
      {
        id: "res-1",
        symbol: "NVDA",
        side: "BUY",
        quantity: "50",
        estimate: "75000000",
      },
    ],
  };

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    onAccountSelect?.(accountId);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Portfolio</h1>

      {accounts && accounts.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <label>Account: </label>
          <select value={selectedAccountId} onChange={(e) => handleAccountChange(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 15, marginBottom: 20 }}>
        <CashCard
          total={demoData.cash.total}
          held={demoData.cash.held}
          available={demoData.cash.available}
        />
      </div>

      {Object.keys(demoData.heldBy).length > 0 && (
        <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#fff3cd", borderRadius: 4 }}>
          <h3>Held By Position</h3>
          {Object.entries(demoData.heldBy).map(([symbol, reason]) => (
            <div key={symbol}>
              <strong>{symbol}:</strong> {reason}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h3>Positions</h3>
        {demoData.positions.length === 0 ? (
          <p>No positions</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Symbol</th>
                <th style={{ textAlign: "right", padding: 8 }}>Qty</th>
                <th style={{ textAlign: "right", padding: 8 }}>Avg Cost</th>
                <th style={{ textAlign: "right", padding: 8 }}>Mark</th>
                <th style={{ textAlign: "right", padding: 8 }}>Unrealized P&L</th>
                <th style={{ textAlign: "right", padding: 8 }}>Realized P&L</th>
              </tr>
            </thead>
            <tbody>
              {demoData.positions.map((pos) => (
                <tr key={pos.symbol} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>
                    <strong>{pos.symbol}</strong>
                  </td>
                  <td style={{ padding: 8, textAlign: "right" }}>{pos.quantity}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    ${formatCurrency(pos.avgCost)}
                  </td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    {pos.mark ? `$${formatCurrency(pos.mark)}` : "—"}
                  </td>
                  <td style={{ padding: 8, textAlign: "right", color: Number(pos.unrealizedPnL) >= 0 ? "green" : "red" }}>
                    ${formatCurrency(pos.unrealizedPnL)}
                  </td>
                  <td style={{ padding: 8, textAlign: "right", color: Number(pos.realizedPnL) >= 0 ? "green" : "red" }}>
                    ${formatCurrency(pos.realizedPnL)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {demoData.reservations.length > 0 && (
        <div>
          <h3>Reservations</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Symbol</th>
                <th style={{ textAlign: "left", padding: 8 }}>Side</th>
                <th style={{ textAlign: "right", padding: 8 }}>Qty</th>
                <th style={{ textAlign: "right", padding: 8 }}>Estimate</th>
              </tr>
            </thead>
            <tbody>
              {demoData.reservations.map((res) => (
                <tr key={res.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{res.symbol}</td>
                  <td style={{ padding: 8 }}>
                    <strong>{res.side}</strong>
                  </td>
                  <td style={{ padding: 8, textAlign: "right" }}>{res.quantity}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>${formatCurrency(res.estimate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CashCard({
  total,
  held,
  available,
}: {
  total: string;
  held: string;
  available: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        padding: 20,
        borderRadius: 8,
        backgroundColor: "#f9f9f9",
        gridColumn: "1 / -1",
      }}
    >
      <h3>Cash</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 5 }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: "bold" }}>${formatCurrency(total)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 5 }}>Held</div>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "#ff9800" }}>
            ${formatCurrency(held)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 5 }}>Available</div>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "green" }}>
            ${formatCurrency(available)}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(minorUnits: string): string {
  const num = Number(minorUnits);
  return (num / 1000000).toFixed(2);
}
