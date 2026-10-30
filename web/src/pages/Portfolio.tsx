/**
 * P3 Portfolio: cash, held-by-symbol, positions, reservations. RISK/OPS/ADMIN
 * must pick an account first (TRADER uses their own). Tests: UP7, UP8.
 */
import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider.js";
import { formatMoney } from "../utils/money.js";

interface Balances {
  total: string;
  held: string;
  available: string;
  heldBy?: Record<string, string>;
}

interface Position {
  symbol: string;
  quantity: string;
  avgCost: string;
  mark: string | null;
  unrealizedPnL: string | null;
  realizedPnL: string;
}

interface Reservation {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: string;
  estimate: string;
}

export function PortfolioPage() {
  const { client, user } = useAuth();
  const needsAccountPicker = user ? user.role !== "TRADER" : false;
  const [accountId, setAccountId] = useState<string>(user?.accountIds[0] ?? "");

  const [balances, setBalances] = useState<Balances | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [b, p, r] = await Promise.all([
          client.get<Balances>(`/accounts/${accountId}/balances`),
          client.get<Position[]>(`/accounts/${accountId}/positions`),
          client.get<Reservation[]>(`/accounts/${accountId}/reservations`),
        ]);
        if (cancelled) return;
        setBalances(b);
        setPositions(p);
        setReservations(r);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load portfolio");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accountId, client]);

  if (needsAccountPicker && !accountId) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Portfolio</h1>
        <p>Pick an account to view its portfolio:</p>
        <input
          placeholder="Account ID"
          onKeyDown={(e) => {
            if (e.key === "Enter") setAccountId((e.target as HTMLInputElement).value);
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Portfolio</h1>

      {needsAccountPicker && (
        <div style={{ marginBottom: 20 }}>
          <label>Account: </label>
          <input value={accountId} onChange={(e) => setAccountId(e.target.value)} />
        </div>
      )}

      {loading && <p>Loading portfolio...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && balances && (
        <>
          <CashCard total={balances.total} held={balances.held} available={balances.available} />

          {balances.heldBy && Object.keys(balances.heldBy).length > 0 && (
            <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#fff3cd", borderRadius: 4 }}>
              <h3>Held By Position</h3>
              {Object.entries(balances.heldBy).map(([symbol, reason]) => (
                <div key={symbol}>
                  <strong>{symbol}:</strong> {reason}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <h3>Positions</h3>
            {!positions || positions.length === 0 ? (
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
                  {positions.map((pos) => (
                    <tr key={pos.symbol} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 8 }}>
                        <strong>{pos.symbol}</strong>
                      </td>
                      <td style={{ padding: 8, textAlign: "right" }}>{pos.quantity}</td>
                      <td style={{ padding: 8, textAlign: "right" }}>{formatMoney(pos.avgCost)}</td>
                      <td style={{ padding: 8, textAlign: "right" }}>{pos.mark ? formatMoney(pos.mark) : "—"}</td>
                      <td style={{ padding: 8, textAlign: "right" }}>
                        {pos.unrealizedPnL === null ? "—" : formatMoney(pos.unrealizedPnL)}
                      </td>
                      <td style={{ padding: 8, textAlign: "right" }}>{formatMoney(pos.realizedPnL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {reservations && reservations.length > 0 && (
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
                  {reservations.map((res) => (
                    <tr key={res.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 8 }}>{res.symbol}</td>
                      <td style={{ padding: 8 }}>
                        <strong>{res.side}</strong>
                      </td>
                      <td style={{ padding: 8, textAlign: "right" }}>{res.quantity}</td>
                      <td style={{ padding: 8, textAlign: "right" }}>{formatMoney(res.estimate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CashCard({ total, held, available }: { total: string; held: string; available: string }) {
  return (
    <div style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8, backgroundColor: "#f9f9f9", marginBottom: 20 }}>
      <h3>Cash</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 5 }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: "bold" }}>{formatMoney(total)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 5 }}>Held</div>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "#ff9800" }}>{formatMoney(held)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 5 }}>Available</div>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "green" }}>{formatMoney(available)}</div>
        </div>
      </div>
    </div>
  );
}
