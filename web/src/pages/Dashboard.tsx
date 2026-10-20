/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Role-based dashboard landing page.
 * Routes to appropriate page based on user role.
 */

import React from "react";
import { useNavigate } from "react-router-dom";

interface DashboardProps {
  userRole: string;
}

// API response types
interface Rejection {
  rejectionId: string;
  symbol: string;
  accountId: string;
  reason: string;
  snapshot?: { heldCash?: string };
}

interface Resting {
  count: number;
  held: bigint;
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

  return (
    <div style={{ padding: 20 }}>
      <p>Redirecting to your dashboard...</p>
    </div>
  );
}

// Stub pages for each role
export function TradingPage() {
  return <div style={{ padding: 20 }}>Trading Page (P2)</div>;
}

export function RiskPage() {
  const [breakers, setBreakers] = React.useState<Array<{ symbol: string; state: string }>>([]);
  const [rejections, setRejections] = React.useState<Rejection[]>([]);
  const [resting, setResting] = React.useState<Record<string, Resting>>({});
  const [haltReason, setHaltReason] = React.useState("");
  const [resumeReason, setResumeReason] = React.useState("");
  const [selectedSymbol, setSelectedSymbol] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const maxHaltDuration = 300000; // 5 minutes in ms

  React.useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const headers = { Authorization: `Bearer ${token}` };

        const [breakersRes, rejectionsRes] = await Promise.all([
          fetch("/api/v1/risk/breakers", { headers }),
          fetch("/api/v1/risk/rejections", { headers }),
        ]);

        if (breakersRes.ok) {
          const data = await breakersRes.json();
          setBreakers(data.breakers || []);
        }
        if (rejectionsRes.ok) {
          const data = await rejectionsRes.json();
          setRejections(data.rejections || []);

          // Calculate resting orders and held funds per symbol
          const restingMap: Record<string, Resting> = {};
          (data.rejections as Rejection[] | undefined)?.forEach((rej: Rejection) => {
            if (!restingMap[rej.symbol]) {
              restingMap[rej.symbol] = { count: 0, held: 0n };
            }
            restingMap[rej.symbol].count++;
            if (rej.snapshot?.heldCash) {
              restingMap[rej.symbol].held += BigInt(rej.snapshot.heldCash);
            }
          });
          setResting(restingMap);
        }
      } catch (err) {
        console.error("Error fetching risk data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    }, 5000);

    document.addEventListener("visibilitychange", fetchData);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", fetchData);
    };
  }, [token]);

  const handleHalt = async (symbol: string) => {
    if (!token || !haltReason.trim()) {
      alert("Reason is required");
      return;
    }
    try {
      const res = await fetch(`/api/v1/risk/symbols/${symbol}/halt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: haltReason }),
      });
      if (res.ok) {
        setHaltReason("");
        setSelectedSymbol("");
        alert(`${symbol} halted`);
      }
    } catch (err) {
      console.error("Error halting symbol", err);
    }
  };

  const handleResume = async (symbol: string) => {
    if (!token || !resumeReason.trim()) {
      alert("Reason is required");
      return;
    }
    try {
      const res = await fetch(`/api/v1/risk/symbols/${symbol}/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: resumeReason }),
      });
      if (res.ok) {
        setResumeReason("");
        alert(`${symbol} resumed (HALF_OPEN state for safety)`);
      }
    } catch (err) {
      console.error("Error resuming symbol", err);
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading risk data...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Risk Console (P5)</h1>

      {/* Breaker Table */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Breakers</h2>
        {breakers.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #666" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Symbol</th>
                <th style={{ textAlign: "left", padding: 8 }}>Status</th>
                <th style={{ textAlign: "left", padding: 8 }}>Incident Time</th>
                <th style={{ textAlign: "left", padding: 8 }}>Time Remaining</th>
                <th style={{ textAlign: "left", padding: 8 }}>Resting Orders</th>
                <th style={{ textAlign: "left", padding: 8 }}>Held Funds</th>
                <th style={{ textAlign: "left", padding: 8 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {breakers.map((breaker: any) => {
                const incidentTime = new Date(breaker.incidentStartTs).getTime();
                const timeElapsed = Date.now() - incidentTime;
                const timeRemaining = Math.max(0, maxHaltDuration - timeElapsed);
                const percentDone = ((timeElapsed / maxHaltDuration) * 100).toFixed(0);
                const rLog = resting[breaker.symbol] || { count: 0, held: 0 };

                return (
                  <tr key={breaker.symbol} style={{ borderBottom: "1px solid #ddd" }}>
                    <td style={{ padding: 8, fontWeight: "bold" }}>{breaker.symbol}</td>
                    <td style={{ padding: 8, color: breaker.status === "ACTIVE" ? "red" : "orange" }}>
                      {breaker.status}
                    </td>
                    <td style={{ padding: 8 }}>{new Date(breaker.incidentStartTs).toLocaleString()}</td>
                    <td style={{ padding: 8 }}>
                      {timeRemaining > 0 ? (
                        <div>
                          <progress value={percentDone} max="100" style={{ width: 100 }} />
                          <span style={{ fontSize: "0.8em" }}>{(timeRemaining / 1000).toFixed(0)}s</span>
                        </div>
                      ) : (
                        "Expired"
                      )}
                    </td>
                    <td style={{ padding: 8 }}>{rLog.count}</td>
                    <td style={{ padding: 8 }}>${(BigInt(rLog.held) / 100n).toString()}</td>
                    <td style={{ padding: 8 }}>
                      <button
                        onClick={() => setSelectedSymbol(breaker.symbol)}
                        style={{ padding: "5px 10px" }}
                      >
                        Resume
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No active breakers</p>
        )}
      </div>

      {/* Halt/Resume Controls */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Halt/Resume</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <h3>Halt Symbol</h3>
            <div style={{ marginBottom: 10 }}>
              <label>Symbol:</label>
              <input
                type="text"
                placeholder="AAPL"
                style={{ width: "100%", padding: 8, marginTop: 5 }}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>Reason (required):</label>
              <textarea
                value={haltReason}
                onChange={(e) => setHaltReason(e.target.value)}
                placeholder="Why are you halting this symbol?"
                style={{ width: "100%", padding: 8, marginTop: 5, height: 60 }}
              />
            </div>
            <button
              onClick={() => handleHalt("ACME")}
              disabled={!haltReason.trim()}
              style={{ padding: "8px 16px" }}
            >
              Halt
            </button>
          </div>

          <div>
            <h3>Resume Symbol</h3>
            {selectedSymbol && (
              <>
                <p>Resuming: <strong>{selectedSymbol}</strong></p>
                <div style={{ marginBottom: 10 }}>
                  <label>Reason (required):</label>
                  <textarea
                    value={resumeReason}
                    onChange={(e) => setResumeReason(e.target.value)}
                    placeholder="Why are you resuming this symbol?"
                    style={{ width: "100%", padding: 8, marginTop: 5, height: 60 }}
                  />
                </div>
                <button
                  onClick={() => handleResume(selectedSymbol)}
                  disabled={!resumeReason.trim()}
                  style={{ padding: "8px 16px", marginRight: 10 }}
                >
                  Resume (→ HALF_OPEN)
                </button>
                <button onClick={() => setSelectedSymbol("")} style={{ padding: "8px 16px" }}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rejections Feed */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Rejections Feed ({rejections.length})</h2>
        {rejections.length > 0 ? (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #666" }}>
                  <th style={{ textAlign: "left", padding: 8 }}>Time</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Symbol</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Account</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejections.map((rej: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
                    <td style={{ padding: 8 }}>{new Date(rej.ts).toLocaleTimeString()}</td>
                    <td style={{ padding: 8 }}>{rej.symbol}</td>
                    <td style={{ padding: 8 }}>{rej.accountId}</td>
                    <td style={{ padding: 8, color: "red" }}>{rej.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No rejections</p>
        )}
      </div>
    </div>
  );
}

interface Shard {
  leaseId: string;
  epoch: number;
  ownerId: string;
  heartbeatAge: number;
  queueDepth: number;
  lastSeq: number;
  snapshotSeq: number;
  stale: boolean;
}

interface Metrics {
  available: boolean;
  commandRate?: number;
}

interface Invariants {
  valid: boolean;
  checks?: Array<{ name: string; pass: boolean }>;
}

interface RecoveryEntry {
  timestamp: string;
  duration: number;
}

interface SimulatorState {
  running: boolean;
  sent?: number;
  backedOff?: number;
}

export function SystemPage() {
  const [shards, setShards] = React.useState<Shard[]>([]);
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [invariants, setInvariants] = React.useState<Invariants | null>(null);
  const [recovery, setRecovery] = React.useState<RecoveryEntry[]>([]);
  const [simulator, setSimulator] = React.useState<SimulatorState | null>(null);
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

export function ReconPage() {
  const [runs, setRuns] = React.useState<any[]>([]);
  const [breaks, setBreaks] = React.useState<any[]>([]);
  const [selectedBreak, setSelectedBreak] = React.useState<any>(null);
  const [resolveReason, setResolveReason] = React.useState("");
  const [uploadError, setUploadError] = React.useState("");
  const [uploadSuccess, setUploadSuccess] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  React.useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const headers = { Authorization: `Bearer ${token}` };

        const [runsRes, breaksRes] = await Promise.all([
          fetch("/api/v1/recon/runs", { headers }),
          fetch("/api/v1/recon/breaks", { headers }),
        ]);

        if (runsRes.ok) {
          const data = await runsRes.json();
          setRuns(data.runs || []);
        }
        if (breaksRes.ok) {
          const data = await breaksRes.json();
          setBreaks(data.breaks || []);
        }
      } catch (err) {
        console.error("Error fetching recon data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    }, 5000);

    document.addEventListener("visibilitychange", fetchData);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", fetchData);
    };
  }, [token]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;

    const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement)?.files?.[0];
    if (!file) {
      setUploadError("Please select a file");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/recon/runs", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        setUploadSuccess(`File ${file.name} processed`);
        setUploadError("");
        setTimeout(() => setUploadSuccess(""), 3000);
      } else if (res.status === 409) {
        setUploadError("Statement already processed");
      } else if (res.status === 413) {
        setUploadError("File too large (max 50MB)");
      } else if (res.status === 400) {
        const errData = await res.json();
        setUploadError(errData.detail || "Invalid file format");
      }
    } catch (err) {
      setUploadError("Upload failed");
      console.error(err);
    }
  };

  const handleResolve = async (breakId: string) => {
    if (!token || !resolveReason.trim()) {
      alert("Reason is required");
      return;
    }
    try {
      const res = await fetch(`/api/v1/recon/breaks/${breakId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: resolveReason }),
      });
      if (res.ok) {
        setResolveReason("");
        setSelectedBreak(null);
        alert("Break resolved");
      }
    } catch (err) {
      console.error("Error resolving break", err);
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading reconciliation data...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Reconciliation (P6)</h1>

      {/* Statement Upload */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Statement Upload</h2>
        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: 10 }}>
            <label>Statement File (CSV/JSON):</label>
            <input
              type="file"
              name="file"
              accept=".csv,.json"
              style={{ display: "block", marginTop: 5 }}
            />
          </div>
          <button type="submit" style={{ padding: "8px 16px" }}>
            Upload
          </button>
        </form>
        {uploadSuccess && <p style={{ color: "green", marginTop: 10 }}>✓ {uploadSuccess}</p>}
        {uploadError && <p style={{ color: "red", marginTop: 10 }}>✗ {uploadError}</p>}
      </div>

      {/* Runs List */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Reconciliation Runs ({runs.length})</h2>
        {runs.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #666" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Run ID</th>
                <th style={{ textAlign: "left", padding: 8 }}>Started</th>
                <th style={{ textAlign: "left", padding: 8 }}>Duration</th>
                <th style={{ textAlign: "left", padding: 8 }}>Breaks Found</th>
                <th style={{ textAlign: "left", padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run: any) => (
                <tr key={run.runId} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: 8 }}>{run.runId}</td>
                  <td style={{ padding: 8 }}>{new Date(run.startedAt).toLocaleString()}</td>
                  <td style={{ padding: 8 }}>{run.durationMs}ms</td>
                  <td style={{ padding: 8 }}>{run.breaksFound}</td>
                  <td style={{ padding: 8, color: run.breaksFound > 0 ? "orange" : "green" }}>
                    {run.breaksFound > 0 ? "HAS BREAKS" : "OK"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No runs yet</p>
        )}
      </div>

      {/* Breaks Table */}
      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Breaks ({breaks.length})</h2>
        {breaks.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #666" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Break ID</th>
                <th style={{ textAlign: "left", padding: 8 }}>Account</th>
                <th style={{ textAlign: "left", padding: 8 }}>Asset</th>
                <th style={{ textAlign: "left", padding: 8 }}>Expected</th>
                <th style={{ textAlign: "left", padding: 8 }}>Actual</th>
                <th style={{ textAlign: "left", padding: 8 }}>Status</th>
                <th style={{ textAlign: "left", padding: 8 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {breaks.map((brk: any) => (
                <tr key={brk.breakId} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: 8 }}>{brk.breakId}</td>
                  <td style={{ padding: 8 }}>{brk.accountId}</td>
                  <td style={{ padding: 8 }}>{brk.asset}</td>
                  <td style={{ padding: 8 }}>${(() => { const val = String(BigInt(brk.expected)); return val.slice(0, -2) + "." + val.slice(-2); })()}</td>
                  <td style={{ padding: 8 }}>${(() => { const val = String(BigInt(brk.actual)); return val.slice(0, -2) + "." + val.slice(-2); })()}</td>
                  <td style={{ padding: 8, color: "red" }}>{brk.status}</td>
                  <td style={{ padding: 8 }}>
                    <button
                      onClick={() => setSelectedBreak(brk)}
                      style={{ padding: "5px 10px" }}
                    >
                      Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No breaks</p>
        )}
      </div>

      {/* Break Detail & Resolve */}
      {selectedBreak && (
        <div style={{ marginBottom: 20, padding: 15, border: "2px solid #ff6b6b", borderRadius: 4, background: "#ffe0e0" }}>
          <h2>Resolve Break: {selectedBreak.breakId}</h2>
          <div style={{ marginBottom: 15 }}>
            <p><strong>Account:</strong> {selectedBreak.accountId}</p>
            <p><strong>Asset:</strong> {selectedBreak.asset}</p>
            <p><strong>Expected:</strong> ${(() => { const val = String(BigInt(selectedBreak.expected)); return val.slice(0, -2) + "." + val.slice(-2); })()}</p>
            <p><strong>Actual:</strong> ${(() => { const val = String(BigInt(selectedBreak.actual)); return val.slice(0, -2) + "." + val.slice(-2); })()}</p>
            <p><strong>Difference:</strong> ${(() => { const diff = String(BigInt(selectedBreak.expected) - BigInt(selectedBreak.actual)); return diff.slice(0, -2) + "." + diff.slice(-2); })()}</p>
          </div>

          {/* Audit Trail */}
          {selectedBreak.auditTrail && selectedBreak.auditTrail.length > 0 && (
            <div style={{ marginBottom: 15, padding: 10, background: "white", borderRadius: 3 }}>
              <h3>Audit Trail</h3>
              <ul style={{ fontSize: "0.85em" }}>
                {selectedBreak.auditTrail.map((entry: any, i: number) => (
                  <li key={i}>{new Date(entry.ts).toLocaleString()}: {entry.action} by {entry.user}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label>Resolution Reason (required):</label>
            <textarea
              value={resolveReason}
              onChange={(e) => setResolveReason(e.target.value)}
              placeholder="Why is this break being resolved? (e.g., 'Statement had data entry error')"
              style={{ width: "100%", padding: 8, marginTop: 5, height: 80 }}
            />
          </div>

          <button
            onClick={() => handleResolve(selectedBreak.breakId)}
            disabled={!resolveReason.trim()}
            style={{ padding: "8px 16px", marginRight: 10, backgroundColor: "#28a745", color: "white", border: "none", borderRadius: 4 }}
          >
            Resolve
          </button>
          <button
            onClick={() => setSelectedBreak(null)}
            style={{ padding: "8px 16px", backgroundColor: "#6c757d", color: "white", border: "none", borderRadius: 4 }}
          >
            Cancel
          </button>
        </div>
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
