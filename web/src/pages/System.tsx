/**
 * P7 System: shard table with epochs/stale flag, metrics summary (degrades
 * gracefully when Prometheus is down), invariants, recovery list, and
 * demo-only simulator/chaos controls. Tests: UP15, UP16.
 */
import React from "react";
import { useAuth } from "../auth/AuthProvider.js";
import { Icon, PageHeading } from "../components/Ui.js";
import { webConfig } from "../config.js";

interface Shard {
  leaseId: string;
  ownedSymbols?: string[];
  owner: string;
  epoch: number;
  stale: boolean;
  lastSeq: number;
  snapshotSeq: number;
}

interface Metrics {
  available: boolean;
  commandsPerSec?: number;
  latencyMs?: { p50?: number; p95?: number; p99?: number };
  queueDepthMax?: number;
  consumerLagMax?: number;
  eventLoopP99Ms?: number;
}

interface Invariants {
  valid: boolean;
  ledgerZeroSum: boolean;
  positionsZeroSum: boolean;
  noNegativeAvailable: boolean;
  projectionsEqualRisk: boolean;
}

interface RecoveryEntry {
  leaseId: string;
  startedAt: string;
  durationMs: number;
  snapshotSeq: number;
  tailLength: number;
  symbolsRecovered: string[];
}

interface SimulatorState {
  running: boolean;
  sent?: number;
  backedOff?: number;
  symbols?: string[];
}

export function SystemPage() {
  const { token } = useAuth();
  const [shards, setShards] = React.useState<Shard[]>([]);
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [invariants, setInvariants] = React.useState<Invariants | null>(null);
  const [recovery, setRecovery] = React.useState<RecoveryEntry[]>([]);
  const [simulator, setSimulator] = React.useState<SimulatorState | null>(null);
  const [isDemo, setIsDemo] = React.useState(false);
  const [chaosEnabled, setChaosEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;

    const fetchAll = async () => {
      try {
        setFetchError(null);
        const headers = { Authorization: `Bearer ${token}` };

        const [shardsRes, metricsRes, invariantsRes, recoveryRes, simRes] = await Promise.all([
          fetch("/api/v1/system/shards", { headers }),
          fetch("/api/v1/system/metrics/summary", { headers }),
          fetch("/api/v1/system/invariants", { headers }),
          fetch("/api/v1/system/recovery", { headers }),
          fetch("/api/v1/system/simulator", { headers }),
        ]);

        if ([shardsRes, metricsRes, invariantsRes, recoveryRes].some(response => !response.ok)) throw new Error("Unable to load system data");
        if (shardsRes.ok) {
          const data = await shardsRes.json();
          setChaosEnabled(data.chaosEnabled === true);
          setShards((data.shards || []).map((s: Shard & { isStale?: boolean }) => ({ ...s, stale: s.isStale ?? s.stale })));
        }
        if (metricsRes.ok) {
          setMetrics(await metricsRes.json());
        }
        if (invariantsRes.ok) {
          setInvariants(await invariantsRes.json());
        }
        if (recoveryRes.ok) {
          const data = await recoveryRes.json();
          setRecovery(data.recoveries || data.recovery || data.recent || []);
        }
        if (simRes.ok) {
          setSimulator(await simRes.json());
          setIsDemo(true);
        } else {
          setIsDemo(false);
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Request failed");
        console.error("Error fetching system data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchAll();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchAll();
    }, webConfig.pollIntervalMs);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [token]);

  const handleSimulatorStart = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/system/simulator/start", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSimulator(await res.json());
    } catch (err) {
      console.error("Error starting simulator", err);
    }
  };

  const handleSimulatorStop = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/system/simulator/stop", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSimulator(await res.json());
    } catch (err) {
      console.error("Error stopping simulator", err);
    }
  };

  const handleRunInvariants = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/system/invariants", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setInvariants(await res.json());
    } catch (err) {
      console.error("Error running invariants", err);
    }
  };

  if (fetchError) return <div className="page"><p role="alert" className="notice notice-error">{fetchError}</p></div>;
  if (loading) return <div className="loading-state" role="status"><span className="spinner" />Loading system data...</div>;

  return (
    <div className="page">
      <PageHeading eyebrow="PLATFORM OPERATIONS" title="System" description="A live view of processing, shard ownership, and recovery." actions={isDemo ? <span className="badge badge-neutral">Demo environment</span> : undefined} />
      <section className="panel">
        <div className="panel-heading"><h2>Metrics Summary</h2><span className="panel-note">From Prometheus</span></div>
        {metrics?.available ? (
          <>
          {metrics.commandsPerSec == null && <div className="notice notice-info">Prometheus is connected; no matching samples have been recorded yet.</div>}
          <div className="system-metrics">
            <p>Commands/sec: {metrics.commandsPerSec?.toFixed(2) ?? "—"}</p>
            <p>Latency p50: {metrics.latencyMs?.p50?.toFixed(2) ?? "—"}ms</p>
            <p>Latency p95: {metrics.latencyMs?.p95?.toFixed(2) ?? "—"}ms</p>
            <p>Latency p99: {metrics.latencyMs?.p99?.toFixed(2) ?? "—"}ms</p>
            <p>Queue Depth Max: {metrics.queueDepthMax ?? "—"}</p>
            <p>Consumer Lag Max: {metrics.consumerLagMax ?? "—"}</p>
            <p>Event Loop P99: {metrics.eventLoopP99Ms?.toFixed(2) ?? "—"}ms</p>
          </div>
          </>
        ) : <div className="notice notice-warning">{metrics?.available ? "Prometheus is connected; metric samples have not arrived yet." : "Prometheus is unreachable. Check that its service is running and scraping the API and shard targets."}</div>}
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>Shards</h2><span className="panel-note">Ownership and journal position</span></div>
        {shards.length === 0 ? <div className="empty-state"><Icon name="system" /><p>No active shards</p></div> : (
          <div className="table-scroll"><table>
            <thead><tr><th>Lease ID</th><th>Owner</th><th className="numeric">Epoch</th><th>Stale</th><th className="numeric">Last Seq</th><th className="numeric">Snapshot Seq</th></tr></thead>
            <tbody>{shards.map((shard) => (
              <tr key={shard.leaseId}>
                <td><strong>{shard.leaseId}</strong></td><td>{shard.owner}</td><td className="numeric">{shard.epoch}</td>
                <td><span className={`badge ${shard.stale ? "badge-bad" : "badge-good"}`}><span className="status-dot" />{shard.stale ? "YES" : "NO"}</span></td>
                <td className="numeric">{shard.lastSeq}</td><td className="numeric">{shard.snapshotSeq}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>Invariants</h2><button onClick={handleRunInvariants}><Icon name="check" />Run Now</button></div>
        {invariants && (
          <div>
            <p>Overall: <span className={`badge ${invariants.valid ? "badge-good" : "badge-bad"}`}>{invariants.valid ? "✓ Valid" : "✗ Invalid"}</span></p>
            <ul className="invariant-list">
              <li>Ledger Zero Sum: <span className={invariants.ledgerZeroSum ? "text-buy" : "text-sell"}>{invariants.ledgerZeroSum ? "✓" : "✗"}</span></li>
              <li>Positions Zero Sum: <span className={invariants.positionsZeroSum ? "text-buy" : "text-sell"}>{invariants.positionsZeroSum ? "✓" : "✗"}</span></li>
              <li>No Negative Available: <span className={invariants.noNegativeAvailable ? "text-buy" : "text-sell"}>{invariants.noNegativeAvailable ? "✓" : "✗"}</span></li>
              <li>Projections = Risk: <span className={invariants.projectionsEqualRisk ? "text-buy" : "text-sell"}>{invariants.projectionsEqualRisk ? "✓" : "✗"}</span></li>
            </ul>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>Recent Recovery Operations ({recovery.length})</h2><span className="panel-note">Recorded recoveries</span></div>
        {recovery.length > 0 ? (
          <div className="table-scroll bounded-table"><table>
            <thead><tr><th>Lease</th><th>Symbols</th><th>Start Time</th><th className="numeric">Duration (ms)</th><th className="numeric">Snapshot Seq</th><th className="numeric">Tail Length</th></tr></thead>
            <tbody>{recovery.map((rec, i) => (
              <tr key={i}><td>{rec.leaseId}</td><td>{rec.symbolsRecovered.join(", ")}</td><td>{new Date(rec.startedAt).toLocaleString()}</td><td className="numeric">{rec.durationMs}</td><td className="numeric">{rec.snapshotSeq}</td><td className="numeric">{rec.tailLength}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty-state"><p>No recent recovery operations</p><small>Recovery history appears here when a component restarts.</small></div>}
      </section>

      {isDemo && (
        <div className="split-grid">
          <section className="panel panel-muted">
            <div className="panel-heading"><h2>Simulator</h2><span className="badge badge-neutral">Demo only</span></div>
            {simulator && (
              <div className="form-stack">
                <p>Status: <span className={`badge ${simulator.running ? "badge-good" : "badge-neutral"}`}>{simulator.running ? "✓ Running" : "⊘ Stopped"}</span></p>
                <p className="mono">Sent: {simulator.sent ?? "—"} | Backed Off: {simulator.backedOff ?? "—"}</p>
                <p className="muted">Symbols: {simulator.symbols?.join(", ") || "—"}</p>
                <div className="form-actions">
                  <button className="primary-button" onClick={handleSimulatorStart} disabled={simulator.running}>Start</button>
                  <button onClick={handleSimulatorStop} disabled={!simulator.running}>Stop</button>
                </div>
              </div>
            )}
          </section>
          {chaosEnabled && (
            <section className="panel panel-warning">
              <div className="panel-heading"><h2>Chaos Controls</h2><span className="badge badge-warn">Demo only</span></div>
              <p className="panel-subtitle">Inject faults into shards for testing recovery.</p>
              <div className="chaos-controls">{shards.filter(shard => (shard.ownedSymbols?.length ?? 0) > 0).map((shard) => (
                <div key={shard.leaseId} className="chaos-shard">
                  <strong className="mono">{shard.leaseId}</strong>
                  <div className="form-actions">
                    <button className="danger-button" onClick={async () => {
                      const res = await fetch(`/api/v1/admin/demo/chaos/kill/${encodeURIComponent(shard.ownedSymbols?.[0] ?? "")}`, {
                        method: "POST", headers: { Authorization: `Bearer ${token}` },
                      });
                      if (!res.ok) console.error("Kill command failed");
                    }}>Kill</button>
                    <button onClick={async () => {
                      const res = await fetch(`/api/v1/admin/demo/chaos/freeze/${encodeURIComponent(shard.ownedSymbols?.[0] ?? "")}`, {
                        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ durationMs: 5000 }),
                      });
                      if (!res.ok) console.error("Freeze command failed");
                    }}>Freeze 5s</button>
                  </div>
                </div>
              ))}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
