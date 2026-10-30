/**
 * P5 Risk console: breaker table with incident clock, halt/resume with a
 * mandatory reason, rejections feed. Tests: UP11, UP12.
 */
import React from "react";
import { useAuth } from "../auth/AuthProvider.js";

interface Rejection {
  rejectionId: string;
  symbol: string;
  accountId: string;
  reason: string;
  ts: string;
  snapshot?: { heldCash?: string };
}

interface Resting {
  count: number;
  held: bigint;
}

interface Breaker {
  symbol: string;
  status: string;
  incidentStartTs: string;
}

export function RiskPage() {
  const { token } = useAuth();
  const [breakers, setBreakers] = React.useState<Breaker[]>([]);
  const [rejections, setRejections] = React.useState<Rejection[]>([]);
  const [resting, setResting] = React.useState<Record<string, Resting>>({});
  const [haltSymbol, setHaltSymbol] = React.useState("ACME");
  const [haltReason, setHaltReason] = React.useState("");
  const [resumeReason, setResumeReason] = React.useState("");
  const [selectedSymbol, setSelectedSymbol] = React.useState("");
  const [loading, setLoading] = React.useState(true);

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

          const restingMap: Record<string, Resting> = {};
          (data.rejections as Rejection[] | undefined)?.forEach((rej) => {
            const entry = restingMap[rej.symbol] ?? { count: 0, held: 0n };
            entry.count++;
            if (rej.snapshot?.heldCash) {
              entry.held += BigInt(rej.snapshot.heldCash);
            }
            restingMap[rej.symbol] = entry;
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
      if (document.visibilityState === "visible") fetchData();
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: haltReason }),
      });
      if (res.ok) {
        setHaltReason("");
        setSelectedSymbol("");
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: resumeReason }),
      });
      if (res.ok) {
        setResumeReason("");
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
              {breakers.map((breaker) => {
                const incidentTime = new Date(breaker.incidentStartTs).getTime();
                const timeElapsed = Date.now() - incidentTime;
                const timeRemaining = Math.max(0, maxHaltDuration - timeElapsed);
                const percentDone = ((timeElapsed / maxHaltDuration) * 100).toFixed(0);
                const rLog = resting[breaker.symbol] || { count: 0, held: 0n };

                return (
                  <tr key={breaker.symbol} style={{ borderBottom: "1px solid #ddd" }}>
                    <td style={{ padding: 8, fontWeight: "bold" }}>{breaker.symbol}</td>
                    <td style={{ padding: 8, color: breaker.status === "ACTIVE" ? "red" : "orange" }}>{breaker.status}</td>
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
                    <td style={{ padding: 8 }}>${(rLog.held / 100n).toString()}</td>
                    <td style={{ padding: 8 }}>
                      <button onClick={() => setSelectedSymbol(breaker.symbol)} style={{ padding: "5px 10px" }}>
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

      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Halt/Resume</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <h3>Halt Symbol</h3>
            <div style={{ marginBottom: 10 }}>
              <label>Symbol:</label>
              <input
                type="text"
                value={haltSymbol}
                onChange={(e) => setHaltSymbol(e.target.value)}
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
            <button onClick={() => handleHalt(haltSymbol)} disabled={!haltReason.trim()} style={{ padding: "8px 16px" }}>
              Halt
            </button>
          </div>

          <div>
            <h3>Resume Symbol</h3>
            {selectedSymbol && (
              <>
                <p>
                  Resuming: <strong>{selectedSymbol}</strong>
                </p>
                <div style={{ marginBottom: 10 }}>
                  <label>Reason (required):</label>
                  <textarea
                    value={resumeReason}
                    onChange={(e) => setResumeReason(e.target.value)}
                    placeholder="Why are you resuming this symbol?"
                    style={{ width: "100%", padding: 8, marginTop: 5, height: 60 }}
                  />
                </div>
                <button onClick={() => handleResume(selectedSymbol)} disabled={!resumeReason.trim()} style={{ padding: "8px 16px", marginRight: 10 }}>
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
                {rejections.map((rej, i) => (
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
