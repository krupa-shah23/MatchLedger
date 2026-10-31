/**
 * P6 Reconciliation: statement upload with duplicate detection, runs list,
 * breaks table, break detail with mandatory-reason resolve and audit trail.
 * Tests: UP13, UP14.
 */
import React from "react";
import { useAuth } from "../auth/AuthProvider.js";
import { displayMoney as formatMoney } from "../utils/display-money.js";
import { Icon, PageHeading } from "../components/Ui.js";
import { webConfig } from "../config.js";

interface ReconRun {
  runId: string;
  startedAt: string;
  durationMs: number;
  breaksFound: number;
}

interface ReconAuditEntry {
  id: number;
  oldStatus: string;
  newStatus: string;
  changedAt: string | number;
  changedBy: string;
  reason: string;
}

interface ReconBreak {
  breakId: string;
  accountId: string;
  asset: string;
  expected: string;
  actual: string;
  status: string;
  auditTrail?: ReconAuditEntry[];
}

function decimalMinor(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error("Invalid monetary decimal");
  const magnitude = BigInt(match[2]!) * 100n + BigInt((match[3] ?? "").padEnd(2, "0"));
  return match[1] === "-" ? -magnitude : magnitude;
}

function minorDecimal(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function ReconPage() {
  const { token } = useAuth();
  const [runs, setRuns] = React.useState<ReconRun[]>([]);
  const [breaks, setBreaks] = React.useState<ReconBreak[]>([]);
  const [breakAudits, setBreakAudits] = React.useState<Record<string, ReconAuditEntry[]>>({});
  const [selectedBreak, setSelectedBreak] = React.useState<ReconBreak | null>(null);
  const [resolveReason, setResolveReason] = React.useState("");
  const [uploadError, setUploadError] = React.useState("");
  const [uploadSuccess, setUploadSuccess] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        setFetchError(null);
        const headers = { Authorization: `Bearer ${token}` };

        const [runsRes, breaksRes] = await Promise.all([
          fetch("/api/v1/recon/runs", { headers }),
          fetch("/api/v1/recon/breaks", { headers }),
        ]);

        if ([runsRes, breaksRes].some(response => !response.ok)) throw new Error("Unable to load recon data");
        if (runsRes.ok) {
          const data = await runsRes.json();
          setRuns(data.runs || []);
        }
        if (breaksRes.ok) {
          const data = await breaksRes.json();
          setBreaks(data.breaks || []);
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Request failed");
        console.error("Error fetching recon data", err);
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
        setUploadError("File too large (max 20 MiB)");
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
        const { audit } = await fetch(`/api/v1/recon/breaks/${encodeURIComponent(breakId)}/audit`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(async response => {
          if (!response.ok) throw new Error(`Could not confirm resolution (HTTP ${response.status})`);
          return response.json();
        });
        if (!audit?.some((entry: ReconAuditEntry) => entry.newStatus === "RESOLVED")) {
          throw new Error("Resolution is pending; no audit outcome has arrived yet.");
        }
        setBreakAudits(current => ({ ...current, [breakId]: audit }));
        setSelectedBreak(null);
        const [breaksRes, runsRes] = await Promise.all([
          fetch("/api/v1/recon/breaks", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/v1/recon/runs", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (breaksRes.ok) setBreaks((await breaksRes.json()).breaks ?? []);
        if (runsRes.ok) setRuns((await runsRes.json()).runs ?? []);
      } else {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.detail ?? `Resolve failed (HTTP ${res.status})`);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Error resolving break");
    }
  };

  if (fetchError) return <div className="page"><p role="alert" className="notice notice-error">{fetchError}</p></div>;
  if (loading) return <div className="loading-state" role="status"><span className="spinner" />Loading reconciliation data...</div>;

  return (
    <div className="page">
      <PageHeading eyebrow="OPERATIONS" title="Reconciliation" description="Compare statements, investigate differences, and keep an audit trail." />
      <section className="panel">
        <div className="panel-heading"><h2>Statement Upload</h2><span className="badge badge-neutral">CSV / JSON</span></div>
        <form onSubmit={handleUpload} className="upload-form">
          <div className="field">
            <label htmlFor="statement-file">Statement File (CSV/JSON):</label>
            <input id="statement-file" type="file" name="file" accept=".csv,.json" />
          </div>
          <button type="submit"><Icon name="recon" />Upload</button>
        </form>
        {uploadSuccess && <p role="status" className="notice notice-info upload-feedback">{uploadSuccess}</p>}
        {uploadError && <p role="alert" className="notice notice-error upload-feedback">{uploadError}</p>}
      </section>

      <section className="panel">
        <div className="panel-heading"><h2>Reconciliation Runs ({runs.length})</h2><span className="panel-note">Statement processing history</span></div>
        {runs.length > 0 ? (
          <div className="table-scroll bounded-table"><table>
            <thead><tr><th>Run ID</th><th>Started</th><th className="numeric">Duration</th><th className="numeric">Breaks Found</th><th>Status</th></tr></thead>
            <tbody>{runs.map((run) => (
              <tr key={run.runId}>
                <td>{run.runId}</td><td>{new Date(run.startedAt).toLocaleString()}</td><td className="numeric">{run.durationMs}ms</td><td className="numeric">{run.breaksFound}</td>
                <td><span className={`badge ${run.breaksFound > 0 ? "badge-warn" : "badge-good"}`}>{run.breaksFound > 0 ? "HAS BREAKS" : "OK"}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty-state"><Icon name="recon" /><p>No runs yet</p><small>Upload a statement to start a reconciliation run.</small></div>}
      </section>

      <section className="panel">
        <div className="panel-heading"><h2>Breaks ({breaks.length})</h2><span className="panel-note">Differences requiring review</span></div>
        {breaks.length > 0 ? (
          <div className="table-scroll bounded-table"><table>
            <thead><tr><th>Break ID</th><th>Account</th><th>Asset</th><th className="numeric">Expected</th><th className="numeric">Actual</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{breaks.map((brk) => (
              <tr key={brk.breakId}>
                <td>{brk.breakId}</td><td>{brk.accountId}</td><td>{brk.asset}</td><td className="numeric">{formatMoney(brk.expected)}</td><td className="numeric">{formatMoney(brk.actual)}</td>
                <td><span className={`badge ${brk.status === "RESOLVED" ? "badge-good" : "badge-warn"}`}>{brk.status}</span></td>
                <td><button onClick={async () => {
                  setSelectedBreak(brk);
                  if (token) {
                    try {
                      const response = await fetch(`/api/v1/recon/breaks/${encodeURIComponent(brk.breakId)}/audit`, { headers: { Authorization: `Bearer ${token}` } });
                      if (response.ok) {
                        const data = await response.json();
                        setBreakAudits(current => ({ ...current, [brk.breakId]: data.audit ?? [] }));
                      }
                    } catch { /* audit history is optional while the break detail remains available */ }
                  }
                }}>Resolve</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty-state"><Icon name="check" /><p>No breaks</p><small>No reconciliation differences to display.</small></div>}
      </section>

      {selectedBreak && (
        <section className="panel panel-warning">
          <h2>Resolve Break: {selectedBreak.breakId}</h2>
          <div className="detail-grid resolution-details">
            <div><label>Account</label><div>{selectedBreak.accountId}</div></div>
            <div><label>Asset</label><div>{selectedBreak.asset}</div></div>
            <div><label>Difference</label><div>{formatMoney(minorDecimal(decimalMinor(selectedBreak.expected) - decimalMinor(selectedBreak.actual)))}</div></div>
            <div><label>Expected</label><div>{formatMoney(selectedBreak.expected)}</div></div>
            <div><label>Actual</label><div>{formatMoney(selectedBreak.actual)}</div></div>
          </div>
          {(breakAudits[selectedBreak.breakId] ?? selectedBreak.auditTrail ?? []).length > 0 && (
            <div className="audit-trail"><h3>Audit Trail</h3><ul>{(breakAudits[selectedBreak.breakId] ?? selectedBreak.auditTrail ?? []).map((entry, i) => (
              <li key={i}>{new Date(entry.changedAt).toLocaleString()}: {entry.oldStatus} → {entry.newStatus} by {entry.changedBy}; {entry.reason}</li>
            ))}</ul></div>
          )}
          <div className="field">
            <label htmlFor="resolution-reason">Resolution Reason (required):</label>
            <textarea id="resolution-reason" value={resolveReason} onChange={(e) => setResolveReason(e.target.value)} placeholder="Why is this break being resolved? (e.g., 'Statement had data entry error')" rows={3} />
          </div>
          <div className="form-actions">
            <button className="primary-button" onClick={() => handleResolve(selectedBreak.breakId)} disabled={!resolveReason.trim()}>Resolve</button>
            <button onClick={() => setSelectedBreak(null)}>Cancel</button>
          </div>
        </section>
      )}
    </div>
  );
}
