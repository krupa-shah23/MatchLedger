# Week 11 Architecture Decisions (DEMO1-DEMO5 & System Monitoring)

## Design Rationale

### 1. Simulator as In-Process Component
**Decision:** Simulator runs in API server process with injected scheduler, not as separate service.

**Rationale:** Deterministic order generation for testing doesn't require network isolation. Mulberry32 PRNG ensures reproducible scenarios (same seed = identical order stream). Reduces operational complexity for demo/testing scenarios.

**Trade-off:** Single instance limits load testing; production would need distributed simulator or synthetic load patterns instead.

---

### 2. PromQL Allowlist (No User Input in Queries)
**Decision:** All Prometheus queries hardcoded in prom-queries.ts; user-supplied metric names forbidden.

**Rationale:** PromQL injection vulnerability would let attackers exfiltrate arbitrary metrics or DoS Prometheus. Fixed set of safe queries (rate, histogram_quantile on known metrics) prevents this. Graceful degradation when Prometheus unavailable (returns `available: false`, not 503).

**Trade-off:** Adding new metrics requires code change, not runtime configuration. Acceptable for fixed monitoring dashboard.

---

### 3. Breaker Incident Clock
**Decision:** UI shows elapsed incident duration from the incident timestamp. It does not invent a five-minute expiry; recovery behavior remains governed by the engine's `BreakerConfig.maxHaltDurationMs`.

**Rationale:** An elapsed clock reports observed state without suggesting an automatic recovery deadline that the API does not provide. The UI polling interval is centrally configured through `VITE_POLL_INTERVAL_MS` with a validated default.

**Trade-off:** Operators see duration rather than predicted time-to-recovery.

---

### 4. Resume Shows HALF_OPEN State
**Decision:** Resume endpoint returns immediately; UI shows "→ HALF_OPEN" to warn operator of increased monitoring during recovery.

**Rationale:** HALF_OPEN is the current projection/UI label for a resumed symbol. Separate tighter concurrency/risk behavior is UNVERIFIED; the label alone does not establish it. Signals to traders that market is healing, not fully healthy. Prevents flood of orders before risk limits recalibrate.

**Trade-off:** Requires operator understanding of breaker state machine; could be automated in full system.

---

### 5. Statement Upload as Multipart (Not Streaming)
**Decision:** POST /recon/runs accepts multipart/form-data files up to 20 MiB; duplicate detection via SHA256 file hash.

**Rationale:** Simple HTTP form (no special encoding); reusable across browsers. Duplicate check prevents double-processing of same statement file. SHA256 deterministic and fast for the configured upload bound.

**Trade-off:** 20 MiB bounded buffering is OK for daily statements; streaming would be needed for continuous ingest.

---

### 6. Breaks Table with Inline Filter & Detail
**Decision:** Breaks shown in table with filter buttons; click row → modal with audit trail + mandatory-reason resolve.

**Rationale:** Compact list view fits 20-50 breaks per run; filter by account/asset reduces cognitive load. Modal prevents accidental resolution; audit trail shows who changed what and when.

**Trade-off:** Modal blocks other actions; batch operations not supported (would need checkbox pattern).

---

### 7. Audit Trail (timestamp, action, user)
**Decision:** All break status changes logged to database with exact timestamp and user ID.

**Rationale:** Regulatory requirement for financial systems; proves who authorized each break resolution and when. Immutable log for disputes.

**Trade-off:** Storage grows linearly with updates; cleanup policy needed (e.g., delete after 7 years).

---

### 8. System Page: Shards Table with Stale Detection
**Decision:** Shard table shows owner, epoch, stale flag (heartbeat age > 30s), queue depth, last seq, snapshot seq.

**Rationale:** 30s threshold catches hung shards (heartbeat interval is 5s; 6 missed = 30s stale). Queue depth predicts backpressure. Last seq vs snapshot seq shows how much tail to replay on recovery.

**Trade-off:** The stale interval follows HEARTBEAT_MS; endpoint behavior is covered by HT3-live.

---

### 9. Metrics Card: Graceful Degradation
**Decision:** GET /system/metrics/summary returns 200 with `available: false` when Prometheus down, never 503.

**Rationale:** System page should always render, even if observability is unavailable. Operator can still see shard table, invariants, recovery ops. Prometheus outage doesn't break operational UI.

**Trade-off:** Can't distinguish between "no metrics yet" and "Prometheus broken"; would need separate status endpoint.

---

### 10. Visibility-Based Polling (Document API)
**Decision:** All real-time pages (system, risk, recon) check `document.visibilityState`; pause polling when tab hidden.

**Rationale:** Saves bandwidth and CPU when user is on different tab; resumes immediately when tab regains focus. No fixed sleeps in E2E tests (wait for UI conditions instead).

**Trade-off:** Stale data visible briefly after tab switch; acceptable for demo (true real-time uses WebSocket).

---

### 11. Chaos Commands via control.commands Topic
**Decision:** Kill/Freeze shard commands routed through control.commands Kafka topic, keyed by symbol.

**Rationale:** Reuses existing ordering guarantees (same Kafka partition processes all shard-0 commands in order). Shard host subscribes to control.commands and handles Kill/Freeze events.

**Trade-off:** Delivery latency is UNVERIFIED; no millisecond bound is claimed. Separate Kafka topics do not establish ordering between orders and control messages.

---

### 12. Demo-Only Mode Detection (PROFILE env var)
**Decision:** Simulator, chaos controls, demo reset endpoints only available when PROFILE=demo.

**Rationale:** Prevents accidental order injection or chaos in production. Single env var gates all demo features.

**Trade-off:** Can't mix demo and prod in same deployment; would need role-based gates for that.

---

### 13. Fixed Simulator Seed for E2E Tests
**Decision:** Playwright E2E uses `seed = Date.now()` on /system/simulator/start; not fixed per test.

**Rationale:** Deterministic within a test run (same seed until stop), but new run gets new seed. Prevents memorized test scenarios; exercises different market conditions.

**Trade-off:** Can't guarantee exact same order sequence across runs; use test assertions on counts (e.g., "sent > 0") not exact order IDs.

---

### 14. Risk Console: Mandatory Reason for Halt & Resume
**Decision:** Both halt and resume require non-empty reason text field; button disabled until filled.

**Rationale:** Forces operator to articulate decision (creates audit trail, prevents fat-finger clicks). Reason stored in database as decision justification.

**Trade-off:** Adds latency to emergency halt (must type reason); could be pre-filled templates for common scenarios.

---

### 15. Rejections Feed: Per-Symbol Resting Orders & Held Funds
**Decision:** Risk console shows aggregate counts (resting orders, held cash) grouped by symbol under breaker.

**Rationale:** Tells risk officer how much capital is stuck per symbol; informs halt scope decisions. Computed from resting_orders and active CASH reservations in getBreakers (packages/projections/src/queries.ts), not rejection snapshots.

**Trade-off:** These values follow projection progress; they can lag journal/risk state.

---

### 16. Error Display: 400, 409, 413 Inline
**Decision:** Statement upload shows error messages inline above form (no modal, no toast).

**Rationale:** Stays in same context; user can correct and retry immediately. Identical statement content is idempotently accepted with 202; 413 reports the size bound. This is implemented in packages/api/src/routes/recon.ts.

**Trade-off:** Multiple sequential uploads show only latest error; history not visible.

---

### 17. Empty States: Descriptive, Not Blank
**Decision:** "No open orders", "No active breakers", "No events" instead of empty table.

**Rationale:** Confirms page loaded and data is empty, not hung/broken. Clarity on why nothing displayed.

**Trade-off:** Requires copy for every empty state; easy to become inconsistent if not managed.

---

### 18. Loading States: "Loading ..." with Spinners
**Decision:** Each section (shards, metrics, invariants) shows "Loading <section>..." while fetching.

**Rationale:** Prevents "why is page blank?" confusion. Operator knows system is working, just waiting.

**Trade-off:** May show "Loading" briefly on fast networks; acceptable UX cost.

---

## Implementation Constraints

### Single API Instance (No HA)
- All state (simulator, session auth) tied to single process
- Restart loses simulator state (acceptable for demo)
- Production would need distributed state (Redis/Kafka)

### No Mobile Layout
- All pages assume desktop viewport (1280px+)
- Touch-friendly controls not implemented
- Acceptable for operational tools (traders use desktops)

### Latency Valid on Single Host Only
- Metrics (command rate, latency) assume co-located Prometheus
- Network latency not modeled
- Cross-region deployments would see inflated metrics
- Production needs latency-aware sampling

---

## Placeholders Deferred

The following TODOs are architectural, not oversight:

- **Pool management (main.ts):** Runtime creates pool; test harness provides mock
- **User/account creation (admin.ts):** CRUD deferred to Phase B (currently stub)
- **Reconciliation run storage (recon.ts):** Would store file hash in durable store; currently mock
- **Invariants check (system.ts):** Sketch of 4 checks; full ledger traversal deferred
- **WebSocket hub (ws/gateway.ts):** Subscription logic stubbed; real pub/sub deferred to Phase C
- **Redelivery & recovery (recover-pipeline.ts):** Advanced recovery modes stubbed

These are not "undone" but "not part of scope" (Week 11 focuses on system monitoring + demo UX, not admin APIs or complex recovery flows).

---

## Test Flake Results — 2026-10-31

The latest Week 11 flake gate completed 20/20 iterations green across root unit, web unit, and integration targets (see [PROGRESS.md](../PROGRESS.md)). Integration reported 73 skipped tests per iteration, so those cases were not exercised by the gate. The prior “<2%” timing-variance and “no race conditions” claims have no retained run artifact and remain unverified; they are not claimed here.

## Verification provenance

Entries 1–18 exist, but this document records decisions, not blanket proof of their implementation. Current gate results and unresolved findings are linked from PROGRESS.md. The stream-state reducer was AI-written during this conversation; hand-authorship cannot be certified. A human must still watch the browser demo.
