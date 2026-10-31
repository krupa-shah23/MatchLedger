/**
 * P5 Risk console: breaker table with incident clock, halt/resume with a
 * mandatory reason, rejections feed. Tests: UP11, UP12.
 */
import React from "react";
import { useAuth } from "../auth/AuthProvider.js";
import { Icon, PageHeading } from "../components/Ui.js";
import { webConfig } from "../config.js";
import { displayMoney } from "../utils/display-money.js";
import { useToast } from "../components/Toast.js";

interface Rejection {
  rejectionId: string;
  symbol: string;
  accountId: string;
  reason: string;
  ts: string;
  snapshot?: { heldCash?: string };
}

interface Breaker {
  symbol: string;
  status: string;
  incidentStartTs: string;
  restingOrders?: number;
  heldFunds?: string;
}

export function RiskPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [breakers, setBreakers] = React.useState<Breaker[]>([]);
  const [rejections, setRejections] = React.useState<Rejection[]>([]);
  const [haltSymbol, setHaltSymbol] = React.useState("ACME");
  const [haltReason, setHaltReason] = React.useState("");
  const [resumeReason, setResumeReason] = React.useState("");
  const [selectedSymbol, setSelectedSymbol] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{ symbol: string; action: "halt" | "resume" } | null>(null);
  const pendingActionRef = React.useRef<typeof pendingAction>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        setFetchError(null);
        const headers = { Authorization: `Bearer ${token}` };

        const [breakersRes, rejectionsRes] = await Promise.all([
          fetch("/api/v1/risk/breakers", { headers }),
          fetch("/api/v1/risk/rejections", { headers }),
        ]);

        if ([breakersRes, rejectionsRes].some(response => !response.ok)) throw new Error("Unable to load risk data");
        if (breakersRes.ok) {
          const data = await breakersRes.json();
          const latestBreakers = (Array.isArray(data) ? data : data.breakers || []).map((b: Breaker & { state?: string }) => ({ ...b, status: b.state ?? b.status }));
          setBreakers(latestBreakers);
          const pending = pendingActionRef.current;
          const latest = pending && latestBreakers.find((breaker: Breaker) => breaker.symbol === pending.symbol);
          const reached = latest && (pending.action === "halt" ? latest.status === "OPEN" : latest.status === "HALF_OPEN" || latest.status === "CLOSED");
          if (pending && latest && reached) {
            setActionMessage(`${pending.symbol} is now ${latest.status}.`);
            pendingActionRef.current = null;
            setPendingAction(null);
            setSelectedSymbol("");
          }
        }
        if (rejectionsRes.ok) {
          const data = await rejectionsRes.json();
          setRejections(Array.isArray(data) ? data : data.rejections || []);


        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Request failed");
        console.error("Error fetching risk data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchData();
    }, webConfig.pollIntervalMs);

    const onVisible = () => { if (document.visibilityState === "visible") void fetchData(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, refreshTick]);

  const submitBreakerAction = async (action: "halt" | "resume", symbol: string, reason: string) => {
    if (!token || !reason.trim()) return;
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/v1/risk/symbols/${encodeURIComponent(symbol)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const result = await response.json().catch(() => ({})) as { detail?: string; title?: string };
      if (!response.ok) throw new Error(result.detail ?? result.title ?? `Request failed (HTTP ${response.status})`);

      pendingActionRef.current = { symbol, action };
      setPendingAction({ symbol, action });
      setActionMessage(`${action === "halt" ? "Halt" : "Resume"} accepted for ${symbol}; waiting for the market state update.`);
      if (action === "halt") setHaltReason("");
      else setResumeReason("");
      setRefreshTick(value => value + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setActionError(`Could not ${action} ${symbol}: ${message}`);
      showToast(`Could not ${action} ${symbol}. ${message}`, "error");
    }
  };

  const handleHalt = async (symbol: string) => {
    await submitBreakerAction("halt", symbol, haltReason);
  };

  const handleResume = async (symbol: string) => {
    await submitBreakerAction("resume", symbol, resumeReason);
  };

  if (fetchError) return <div className="page"><p role="alert" className="notice notice-error">{fetchError}</p></div>;
  if (loading) return <div className="loading-state" role="status"><span className="spinner" />Loading risk data...</div>;

  return (
    <div className="page">
      <PageHeading eyebrow="MARKET SAFEGUARDS" title="Risk Console" description="Monitor circuit breakers, manage incidents, and review rejected orders." />
      {actionError && <p role="alert" className="notice notice-error">{actionError}</p>}
      {actionMessage && <p role="status" className="notice notice-info">{actionMessage}</p>}
      <section className="panel">
        <div className="panel-heading"><h2>Breakers</h2><span className="panel-note">Current market state</span></div>
        {breakers.length > 0 ? (
          <div className="table-scroll"><table>
            <thead><tr><th>Symbol</th><th>Status</th><th>Incident Time</th><th>Incident Duration</th><th className="numeric">Resting Orders</th><th className="numeric">Held Funds</th><th>Action</th></tr></thead>
            <tbody>{breakers.map((breaker) => {
              const incidentTime = new Date(breaker.incidentStartTs).getTime();
              const incidentDurationSeconds = Math.floor(Math.max(0, Date.now() - incidentTime) / 1000);
              return (
                <tr key={breaker.symbol}>
                  <td><strong>{breaker.symbol}</strong></td>
                  <td><span className={`badge ${breaker.status === "CLOSED" ? "badge-good" : "badge-warn"}`}>{breaker.status}</span></td>
                  <td>{globalThis.isFinite(incidentTime) ? new Date(incidentTime).toLocaleString() : "—"}</td>
                  <td>{globalThis.isFinite(incidentDurationSeconds) ? `${incidentDurationSeconds}s` : "—"}</td>
                  <td className="numeric">{breaker.restingOrders ?? 0}</td>
                  <td className="numeric">{displayMoney(breaker.heldFunds ?? "0.00")}</td>
                  <td><button onClick={() => setSelectedSymbol(breaker.symbol)} disabled={breaker.status === "CLOSED" || pendingAction !== null}>{pendingAction?.symbol === breaker.symbol && pendingAction.action === "resume" ? "Resuming..." : "Resume"}</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="empty-state"><Icon name="risk" /><p>No active breakers</p></div>}
      </section>

      <section className="panel">
        <div className="panel-heading"><h2>Halt/Resume</h2><span className="panel-note">A reason is required for every action</span></div>
        <div className="split-grid">
          <div className="form-stack">
            <h3>Halt Symbol</h3>
            <div className="field">
              <label htmlFor="halt-symbol">Symbol</label>
              <input id="halt-symbol" value={haltSymbol} onChange={(e) => setHaltSymbol(e.target.value)} placeholder="AAPL" />
            </div>
            <div className="field">
              <label htmlFor="halt-reason">Reason (required)</label>
              <textarea id="halt-reason" value={haltReason} onChange={(e) => setHaltReason(e.target.value)} placeholder="Why are you halting this symbol?" rows={3} />
            </div>
            <div><button className="danger-button" onClick={() => handleHalt(haltSymbol)} disabled={!haltReason.trim() || pendingAction !== null}>{pendingAction?.symbol === haltSymbol && pendingAction.action === "halt" ? "Halting..." : "Halt"}</button></div>
          </div>
          <div className="form-stack">
            <h3>Resume Symbol</h3>
            {selectedSymbol ? (
              <>
                <p className="notice notice-info">Resuming: <strong>{selectedSymbol}</strong></p>
                <div className="field">
                  <label htmlFor="resume-reason">Reason (required)</label>
                  <textarea id="resume-reason" value={resumeReason} onChange={(e) => setResumeReason(e.target.value)} placeholder="Why are you resuming this symbol?" rows={3} />
                </div>
                <div className="form-actions">
                  <button className="primary-button" onClick={() => handleResume(selectedSymbol)} disabled={!resumeReason.trim() || pendingAction !== null}>{pendingAction?.symbol === selectedSymbol && pendingAction.action === "resume" ? "Resuming..." : "Resume (→ HALF_OPEN)"}</button>
                  <button onClick={() => setSelectedSymbol("")} disabled={pendingAction !== null}>Cancel</button>
                </div>
              </>
            ) : <div className="empty-state"><Icon name="risk" /><p>Select a symbol to resume</p><small>Use Resume in the breakers table to review an incident.</small></div>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading"><h2>Rejections Feed ({rejections.length})</h2><span className="panel-note">Latest rejected orders</span></div>
        {rejections.length > 0 ? (
          <div className="table-scroll bounded-table"><table>
            <thead><tr><th>Time</th><th>Symbol</th><th>Account</th><th>Reason</th></tr></thead>
            <tbody>{rejections.map((rej, i) => (
              <tr key={rej.rejectionId ?? i}><td>{new Date(rej.ts).toLocaleTimeString()}</td><td>{rej.symbol}</td><td>{rej.accountId}</td><td className="text-sell">{rej.reason}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty-state"><p>No rejections</p><small>Rejected orders and their reasons appear here.</small></div>}
      </section>
    </div>
  );
}
