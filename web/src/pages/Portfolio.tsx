/**
 * P3 Portfolio: cash, held-by-symbol, positions, reservations. RISK/OPS/ADMIN
 * must pick an account first (TRADER uses their own). Tests: UP7, UP8.
 */
import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider.js";
import { Icon, PageHeading } from "../components/Ui.js";
import { displayMoney as formatMoney } from "../utils/display-money.js";

interface Balances {
  cash: string;
  heldCash: string;
  available: string;
  heldBy?: Record<string, string>;
}

interface Position {
  symbol: string;
  quantity: string;
  costBasis: string;
  mark: string | null;
  unrealizedPnL: string | null;
  realizedPnl: string;
}

interface Reservation {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  amountRemaining: string;
  asset: string;
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
  const availableAccounts = user?.accountIds.map(id => ({ id, name: id })) ?? [];

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

  const heading = <PageHeading eyebrow="ACCOUNT OVERVIEW" title="Portfolio" description="Your cash, positions, and outstanding reservations in one place." />;

  if (needsAccountPicker && !accountId) {
    return (
      <div className="page">
        {heading}
        <section className="panel account-picker">
          <h2>Pick an account to view its portfolio:</h2>
          {availableAccounts.length ? <div className="field account-list-field"><label htmlFor="portfolio-account-select">Available accounts</label><select id="portfolio-account-select" value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">Choose an account</option>{availableAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div> : null}
          <form className="toolbar" onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("accountId") as HTMLInputElement;
            setAccountId(input.value.trim());
          }}>
            <label htmlFor="portfolio-account">Account ID</label>
            <input id="portfolio-account" name="accountId" placeholder="Account ID" required />
            <button type="submit">View portfolio <Icon name="arrow" /></button>
          </form>
          <p className="panel-note">{availableAccounts.length ? "Choose one of the accounts assigned to your login." : "No accounts are assigned to this login. Ask an administrator to assign one."}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      {heading}
      {needsAccountPicker ? (
        <div className="toolbar">
          <label htmlFor="portfolio-account-select">Available accounts:</label>
          {availableAccounts.length > 0 ? <select id="portfolio-account-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">Choose an account</option>{availableAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select> : <span role="status">No accounts are assigned to this login.</span>}
          <label htmlFor="portfolio-account">Account ID:</label>
          <input id="portfolio-account" value={accountId} onChange={(e) => setAccountId(e.target.value.trim())} />
        </div>
      ) : <p className="account-reference">Account <span className="mono">{accountId}</span></p>}

      {loading && <div className="loading-state" role="status"><span className="spinner" />Loading portfolio...</div>}
      {error && <p role="alert" className="notice notice-error">{error}</p>}

      {!loading && !error && balances && (
        <>
          <CashCard total={balances.cash} held={balances.heldCash} available={balances.available} />
          {balances.heldBy && Object.keys(balances.heldBy).length > 0 && (
            <section className="panel panel-warning">
              <h3>Held By Position</h3>
              {Object.entries(balances.heldBy).map(([symbol, reason]) => (
                <p key={symbol}><strong>{symbol}:</strong> {reason}</p>
              ))}
            </section>
          )}
          <section className="panel">
            <div className="panel-heading"><h2>Positions</h2><span className="panel-note">Current holdings</span></div>
            {!positions || positions.length === 0 ? (
              <div className="empty-state"><Icon name="portfolio" /><p>No positions</p><small>Positions appear here after an order is filled.</small></div>
            ) : (
              <div className="table-scroll"><table>
                <thead><tr><th>Symbol</th><th className="numeric">Qty</th><th className="numeric">Cost Basis</th><th className="numeric">Mark</th><th className="numeric">Unrealized P&L</th><th className="numeric">Realized P&L</th></tr></thead>
                <tbody>{positions.map((pos) => (
                  <tr key={pos.symbol}>
                    <td><strong>{pos.symbol}</strong></td>
                    <td className="numeric">{pos.quantity}</td>
                    <td className="numeric">{formatMoney(pos.costBasis)}</td>
                    <td className="numeric">{pos.mark ? formatMoney(pos.mark) : "—"}</td>
                    <td className="numeric">{pos.unrealizedPnL === null ? "—" : formatMoney(pos.unrealizedPnL)}</td>
                    <td className="numeric">{formatMoney(pos.realizedPnl)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading"><h2>Reservations</h2><span className="panel-note">Held for open orders</span></div>
            {!reservations || reservations.length === 0 ? (
              <div className="empty-state"><p>No reservations</p><small>Funds or assets reserved for open orders appear here.</small></div>
            ) : (
              <div className="table-scroll"><table>
                <thead><tr><th>Order</th><th>Symbol</th><th>Asset</th><th className="numeric">Remaining Hold</th></tr></thead>
                <tbody>{reservations.map((res) => (
                  <tr key={res.orderId}>
                    <td><a href={`/orders/${encodeURIComponent(res.orderId)}`}>{res.orderId.substring(0, 8)}...</a></td>
                    <td>{res.symbol}</td><td><strong>{res.asset}</strong></td>
                    <td className="numeric">{(res.asset === "CASH" || res.asset === "USD") ? formatMoney(res.amountRemaining) : res.amountRemaining}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function CashCard({ total, held, available }: { total: string; held: string; available: string }) {
  return (
    <section aria-labelledby="cash-heading">
      <h2 id="cash-heading" className="section-title">Cash</h2>
      <div className="stat-grid">
        <div className="metric-card"><span className="metric-label">Total</span><div className="metric-value">{formatMoney(total)}</div><p className="panel-subtitle">Account cash balance</p></div>
        <div className="metric-card"><span className="metric-label">Held</span><div className="metric-value">{formatMoney(held)}</div><p className="panel-subtitle">Reserved for open orders</p></div>
        <div className="metric-card accent"><span className="metric-label">Available</span><div className="metric-value">{formatMoney(available)}</div><p className="panel-subtitle">Available to trade</p></div>
      </div>
    </section>
  );
}
