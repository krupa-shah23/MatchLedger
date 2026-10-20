/**
 * Role-based dashboard landing page.
 * Routes to appropriate page based on user role.
 */

import React from "react";
import { useNavigate } from "react-router-dom";

interface DashboardProps {
  userRole: string;
}

export function Dashboard({ userRole }: DashboardProps) {
  const navigate = useNavigate();

  React.useEffect(() => {
    // Redirect to role-specific page
    const routes: Record<string, string> = {
      TRADER: "/portfolio",
      RISK: "/risk",
      OPS: "/system",
      ADMIN: "/admin",
    };
    const path = routes[userRole] || "/portfolio";
    navigate(path, { replace: true });
  }, [userRole, navigate]);

  return <div>Redirecting...</div>;
}

// Stub pages for each role
export function TradingPage() {
  return <div style={{ padding: 20 }}>Trading Page (P2)</div>;
}

export function RiskPage() {
  return <div style={{ padding: 20 }}>Risk Page</div>;
}

export function SystemPage() {
  const [shards, setShards] = React.useState<any[]>([]);
  const [metrics, setMetrics] = React.useState<any>(null);
  const [invariants, setInvariants] = React.useState<any>(null);
  const [recovery, setRecovery] = React.useState<any[]>([]);
  const [simulator, setSimulator] = React.useState<any>(null);
  const [isDemo, setIsDemo] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // Fetch API key from localStorage
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // Poll while visible using document visibility API
  React.useEffect(() => {
    if (!token) return;

    const fetchAll = async () => {
      try {
        setLoading(true);
        const headers = { Authorization: `Bearer ${token}` };

        const [shardsRes, metricsRes, invariantsRes, recoveryRes, simRes] = await Promise.all([
          fetch("/api/v1/system/shards", { headers }),
          fetch("/api/v1/system/metrics/summary", { headers }),
          fetch("/api/v1/system/invariants", { headers }),
          fetch("/api/v1/system/recovery", { headers }),
          fetch("/api/v1/system/simulator", { headers }),
        ]);

        if (shardsRes.ok) {
          const data = await shardsRes.json();
          setShards(data.shards || []);
        }
        if (metricsRes.ok) {
          const data = await metricsRes.json();
          setMetrics(data);
        }
        if (invariantsRes.ok) {
          const data = await invariantsRes.json();
          setInvariants(data);
        }
        if (recoveryRes.ok) {
          const data = await recoveryRes.json();
          setRecovery(data.recovery || []);
        }
        if (simRes.ok) {
          const data = await simRes.json();
          setSimulator(data);
          // Check if demo mode by attempting to access demo endpoints
          setIsDemo(true);
        }
      } catch (err) {
        console.error("Error fetching system data", err);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchAll();

    // Set up polling only while visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchAll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAll();
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [token]);

  const handleSimulatorStart = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/system/simulator/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSimulator(data);
      }
    } catch (err) {
      console.error("Error starting simulator", err);
    }
  };

  const handleSimulatorStop = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/system/simulator/stop", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSimulator(data);
      }
    } catch (err) {
      console.error("Error stopping simulator", err);
    }
  };

  const handleRunInvariants = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/system/invariants", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setInvariants(data);
      }
    } catch (err) {
      console.error("Error running invariants", err);
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading system data...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>System (P7)</h1>

      {/* Metrics Summary Card */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Metrics Summary</h2>
        {metrics?.available ? (
          <div>
            <p>Commands/sec: {metrics.commandsPerSec?.toFixed(2) || "—"}</p>
            <p>Latency p50: {metrics.latencyMs?.p50?.toFixed(2) || "—"}ms</p>
            <p>Latency p95: {metrics.latencyMs?.p95?.toFixed(2) || "—"}ms</p>
            <p>Latency p99: {metrics.latencyMs?.p99?.toFixed(2) || "—"}ms</p>
            <p>Queue Depth Max: {metrics.queueDepthMax || "—"}</p>
            <p>Consumer Lag Max: {metrics.consumerLagMax || "—"}</p>
            <p>Event Loop P99: {metrics.eventLoopP99Ms?.toFixed(2) || "—"}ms</p>
          </div>
        ) : (
          <p style={{ color: "orange" }}>Prometheus unavailable - metrics not available</p>
        )}
        <p style={{ fontSize: "0.9em", color: "#666" }}>
          <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer">
            → View in Grafana
          </a>
        </p>
      </div>

      {/* Shard Table */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Shards</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #666" }}>
              <th style={{ textAlign: "left", padding: 8 }}>Lease ID</th>
              <th style={{ textAlign: "left", padding: 8 }}>Owner</th>
              <th style={{ textAlign: "left", padding: 8 }}>Epoch</th>
              <th style={{ textAlign: "left", padding: 8 }}>Stale</th>
              <th style={{ textAlign: "left", padding: 8 }}>Queue Depth</th>
              <th style={{ textAlign: "left", padding: 8 }}>Last Seq</th>
              <th style={{ textAlign: "left", padding: 8 }}>Snapshot Seq</th>
            </tr>
          </thead>
          <tbody>
            {shards.map((shard: any) => (
              <tr key={shard.leaseId} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: 8 }}>{shard.leaseId}</td>
                <td style={{ padding: 8 }}>{shard.owner}</td>
                <td style={{ padding: 8 }}>{shard.epoch}</td>
                <td style={{ padding: 8, color: shard.stale ? "red" : "green" }}>
                  {shard.stale ? "YES" : "NO"}
                </td>
                <td style={{ padding: 8 }}>{shard.queueDepth}</td>
                <td style={{ padding: 8 }}>{shard.lastSeq}</td>
                <td style={{ padding: 8 }}>{shard.snapshotSeq}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invariants Panel */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>
          Invariants{" "}
          <button onClick={handleRunInvariants} style={{ marginLeft: 10 }}>
            Run Now
          </button>
        </h2>
        {invariants && (
          <div>
            <p>
              Overall:{" "}
              <span style={{ color: invariants.valid ? "green" : "red" }}>
                {invariants.valid ? "✓ Valid" : "✗ Invalid"}
              </span>
            </p>
            <ul>
              <li>Ledger Zero Sum: {invariants.ledgerZeroSum ? "✓" : "✗"}</li>
              <li>Positions Zero Sum: {invariants.positionsZeroSum ? "✓" : "✗"}</li>
              <li>No Negative Available: {invariants.noNegativeAvailable ? "✓" : "✗"}</li>
              <li>Projections = Risk: {invariants.projectionsEqualRisk ? "✓" : "✗"}</li>
            </ul>
          </div>
        )}
      </div>

      {/* Recovery List */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Recent Recovery Operations ({recovery.length})</h2>
        {recovery.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #666" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Symbol</th>
                <th style={{ textAlign: "left", padding: 8 }}>Start Time</th>
                <th style={{ textAlign: "left", padding: 8 }}>Duration (ms)</th>
                <th style={{ textAlign: "left", padding: 8 }}>Snapshot Seq</th>
                <th style={{ textAlign: "left", padding: 8 }}>Tail Length</th>
              </tr>
            </thead>
            <tbody>
              {recovery.map((rec: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: 8 }}>{rec.symbol}</td>
                  <td style={{ padding: 8 }}>{new Date(rec.recoveryStartTs).toLocaleString()}</td>
                  <td style={{ padding: 8 }}>{rec.durationMs}</td>
                  <td style={{ padding: 8 }}>{rec.snapshotSeq}</td>
                  <td style={{ padding: 8 }}>{rec.tailLength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No recent recovery operations</p>
        )}
      </div>

      {/* Simulator & Chaos (Demo Only) */}
      {isDemo && (
        <>
          <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ffa500", borderRadius: 4, background: "#fffacd" }}>
            <h2>🧪 Simulator (Demo Only)</h2>
            {simulator && (
              <div>
                <p>Status: {simulator.running ? "✓ Running" : "⊘ Stopped"}</p>
                <p>Sent: {simulator.sent} | Backed Off: {simulator.backedOff}</p>
                <p>Symbols: {simulator.symbols?.join(", ") || "—"}</p>
                <button onClick={handleSimulatorStart} disabled={simulator.running} style={{ marginRight: 10 }}>
                  Start
                </button>
                <button onClick={handleSimulatorStop} disabled={!simulator.running}>
                  Stop
                </button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ffa500", borderRadius: 4, background: "#fffacd" }}>
            <h2>⚡ Chaos Controls (Demo Only)</h2>
            <p>Inject faults into shards for testing recovery:</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {shards.map((shard: any) => (
                <div key={shard.leaseId} style={{ padding: 10, border: "1px solid #ddd" }}>
                  <p style={{ margin: "0 0 10px 0", fontWeight: "bold" }}>{shard.leaseId}</p>
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/v1/admin/demo/chaos/kill/${shard.leaseId.replace("shard-", "")}`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (res.ok) alert("Kill command queued");
                    }}
                    style={{ marginRight: 5, padding: "5px 10px" }}
                  >
                    Kill
                  </button>
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/v1/admin/demo/chaos/freeze/${shard.leaseId.replace("shard-", "")}`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ durationMs: 5000 }),
                      });
                      if (res.ok) alert("Freeze command queued (5s)");
                    }}
                    style={{ padding: "5px 10px" }}
                  >
                    Freeze 5s
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AdminPage() {
  return <div style={{ padding: 20 }}>Admin Page</div>;
}

export function NotAvailablePage() {
  return <div style={{ padding: 20, color: "red" }}>You do not have access to this page.</div>;
}
