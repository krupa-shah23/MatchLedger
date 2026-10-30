/**
 * P6 Reconciliation: statement upload with duplicate detection, runs list,
 * breaks table, break detail with mandatory-reason resolve and audit trail.
 * Tests: UP13, UP14.
 */
import React from "react";
import { useAuth } from "../auth/AuthProvider.js";
import { formatMoney } from "../utils/money.js";

interface ReconRun {
  runId: string;
  startedAt: string;
  durationMs: number;
  breaksFound: number;
}

interface AuditEntry {
  ts: string;
  action: string;
  user: string;
}

interface ReconBreak {
  breakId: string;
  accountId: string;
  asset: string;
  expected: string;
  actual: string;
  status: string;
  auditTrail?: AuditEntry[];
}

export function ReconPage() {
  const { token } = useAuth();
  const [runs, setRuns] = React.useState<ReconRun[]>([]);
  const [breaks, setBreaks] = React.useState<ReconBreak[]>([]);
  const [selectedBreak, setSelectedBreak] = React.useState<ReconBreak | null>(null);
  const [resolveReason, setResolveReason] = React.useState("");
  const [uploadError, setUploadError] = React.useState("");
  const [uploadSuccess, setUploadSuccess] = React.useState("");
  const [loading, setLoading] = React.useState(true);

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
      if (document.visibilityState === "visible") fetchData();
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: resolveReason }),
      });
      if (res.ok) {
        setResolveReason("");
        setSelectedBreak(null);
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

      <div style={{ marginBottom: 20, padding: 15, border: "1px solid #ccc", borderRadius: 4 }}>
        <h2>Statement Upload</h2>
        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: 10 }}>
            <label>Statement File (CSV/JSON):</label>
            <input type="file" name="file" accept=".csv,.json" style={{ display: "block", marginTop: 5 }} />
          </div>
          <button type="submit" style={{ padding: "8px 16px" }}>
            Upload
          </button>
        </form>
        {uploadSuccess && <p style={{ color: "green", marginTop: 10 }}>✓ {uploadSuccess}</p>}
        {uploadError && <p style={{ color: "red", marginTop: 10 }}>✗ {uploadError}</p>}
      </div>

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
              {runs.map((run) => (
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
              {breaks.map((brk) => (
                <tr key={brk.breakId} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: 8 }}>{brk.breakId}</td>
                  <td style={{ padding: 8 }}>{brk.accountId}</td>
                  <td style={{ padding: 8 }}>{brk.asset}</td>
                  <td style={{ padding: 8 }}>{formatMoney(brk.expected)}</td>
                  <td style={{ padding: 8 }}>{formatMoney(brk.actual)}</td>
                  <td style={{ padding: 8, color: "red" }}>{brk.status}</td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => setSelectedBreak(brk)} style={{ padding: "5px 10px" }}>
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

      {selectedBreak && (
        <div style={{ marginBottom: 20, padding: 15, border: "2px solid #ff6b6b", borderRadius: 4, background: "#ffe0e0" }}>
          <h2>Resolve Break: {selectedBreak.breakId}</h2>
          <div style={{ marginBottom: 15 }}>
            <p>
              <strong>Account:</strong> {selectedBreak.accountId}
            </p>
            <p>
              <strong>Asset:</strong> {selectedBreak.asset}
            </p>
            <p>
              <strong>Expected:</strong> {formatMoney(selectedBreak.expected)}
            </p>
            <p>
              <strong>Actual:</strong> {formatMoney(selectedBreak.actual)}
            </p>
            <p>
              <strong>Difference:</strong> {formatMoney(BigInt(selectedBreak.expected) - BigInt(selectedBreak.actual))}
            </p>
          </div>

          {selectedBreak.auditTrail && selectedBreak.auditTrail.length > 0 && (
            <div style={{ marginBottom: 15, padding: 10, background: "white", borderRadius: 3 }}>
              <h3>Audit Trail</h3>
              <ul style={{ fontSize: "0.85em" }}>
                {selectedBreak.auditTrail.map((entry, i) => (
                  <li key={i}>
                    {new Date(entry.ts).toLocaleString()}: {entry.action} by {entry.user}
                  </li>
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
