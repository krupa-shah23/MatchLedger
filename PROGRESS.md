# Week 11 Test Progress

## UI issue follow-up — 2026-10-31

- Fixed empty-body order cancellation: the API client now omits `Content-Type: application/json` when DELETE has no body. Root cause was Fastify rejecting that request as `FST_ERR_CTP_EMPTY_JSON_BODY`. Browser regression `LIVE-P2` clicked Cancel on a real open order; DELETE returned 202.
- Recon status/resolve now use valid status payloads and durable audit entries. Chromium verified uploading a real unmatched statement, resolving its break, and observing the `RESOLVED` audit entry. The upload-size error now matches the API's 20 MiB limit.
- Portfolio account selection uses the authenticated user's assigned accounts. Live `/me` checks returned `acc-demo-trader`, `acc-demo-risk`, `acc-demo-ops`, and `acc-demo-admin` for the respective demo roles.
- Monetary displays use `₹` and bigint/string formatting. These are simulation values with a rupee display symbol; no FX conversion is performed. HALF_OPEN is labeled as recovering rather than halted.
- Authenticated metrics summary returned HTTP 200 with `available: true`; `commandsPerSec` had no sample while event-loop latency had data. A connected Prometheus with no samples for a queried series is not the same as an unavailable service.
- Verification after edits: `npm run build`, `npm run lint`, `npm test` (609 passed, 167 skipped), web tests (78 passed), boundaries and placeholder gates passed. Seven live Chromium scenarios passed; the cancellation scenario passed in a focused rerun after correcting its test selector.

## Interview UI polish — 2026-10-31

- Added subtle page/panel motion, scroll-driven panel reveal where supported, hover lift and softer focus/interactive transitions, and a restrained animated login illustration. All motion is disabled for `prefers-reduced-motion`.
- Toasts now appear top-right, use a larger layout, dismiss after 15 seconds, and show a bottom progress bar that drains over their lifetime. Reduced-motion mode keeps the timeout and suppresses animation.
- Build and lint passed; web tests passed (78/78); root suite passed (609 passed, 167 skipped, 0 failed).

## Trading controls follow-up — 2026-10-31

- Order entry now identifies required fields and invalid quantity/price values, explains when an OPEN breaker pauses trading, and disables submission while halted. A live Trader browser flow submitted a valid ACME limit BUY and received HTTP 202 while the authorized Risk action had ACME in HALF_OPEN.
- Risk halt/resume now surfaces HTTP and network errors in-page and by toast. A 202 action is labeled pending until polling observes the corresponding breaker state; action buttons stay disabled while it is pending.
- Verified a forbidden halt request is visible in the Risk UI test; verified accepted resume updates the displayed breaker state. Build and lint passed; web tests passed (80/80); root suite passed (609 passed, 167 skipped, 0 failed).

## Order submission error follow-up — 2026-10-31

- A fresh Trader page load showed no React hook dependency warning. The warning occurred while Vite hot-replaced the component with a changed hook dependency list; a reload mounts the stable hook list.
- The observed order HTTP 409 was `CONFLICT_DIFFERENT_PAYLOAD`: the same client order ID had already been used for a different payload. Order Entry now starts each new order with a generated unique ID and offers “New ID” after a conflict; network retries retain the same ID. A fresh UI BUY received HTTP 202.
- The screenshot's HTTP 403s were calls to Risk-only halt endpoints while authenticated as TRADER; this is enforced role access. Risk UI now displays the 403 explanation instead of silently ignoring the action.
- Final build/lint passed; web tests passed (80/80); root tests passed (609 passed, 167 skipped, 0 failed); boundaries, placeholder scan, and diff whitespace check passed.

## Internal client-order identity — 2026-10-31

- Removed the client order ID input and manual “New ID” control. Each new submission generates a hidden UUID clientOrderId and sends it to POST /orders. An uncertain retry with unchanged payload reuses that ID; a changed payload or conflict gets a new one.
- Browser verification confirmed no ID field is visible, the request contains a generated `web-` ID, and the API returns HTTP 202. Web tests pass (81/81); root suite passes (609 passed, 167 skipped, 0 failed); build and lint pass.

## MatchLedger landing page — 2026-10-31

- Added a signed-out `/` welcome page with MatchLedger-specific order lifecycle copy, workspace/demo links, and a CSS orbit connecting Order, Risk, Match, and Ledger. Kept `/login` as the existing authentication route.
- Added desktop and mobile layout; orbit nodes rotate around the center and counter-rotate to keep labels upright. Scroll-card reveals and orbit motion respect `prefers-reduced-motion`; no animation dependency added.
- Browser review: landing route rendered with no page errors, sign-in points to `/login`, and a 390px viewport had no horizontal overflow after tightening the orbit radius. Screenshot: `/tmp/matchledger-landing-mobile.png`.
- Build/lint passed; web suite passed (82/82); root suite passed (609 passed, 167 skipped, 0 failed); boundaries, placeholder scan, and `git diff --check` passed.

## Latest verification — 2026-10-31

- `npm ci` completed after dependency updates: 372 packages added, 390 audited. `npm audit` reports 10 moderate findings and 0 high / critical; see `docs/versions.md` for the pinned updates and why the remaining ESLint toolchain findings were not force-downgraded.
- Latest root run: 591 passed, 167 skipped, 0 failed (`npm test`). The skip names and reasons are listed in `docs/WEEK-11-TEST-INVENTORY.md`.
- Latest web run: 77 passed, 0 skipped, 0 failed (`npm test --workspace @matchledger/web`).
- Latest opt-in integration run (`RUN_INTEGRATION=1`): 80 passed, 11 skipped, 0 failed. The 11 skip names and reasons are listed in `docs/WEEK-11-TEST-INVENTORY.md`. A plain integration run (without the opt-in flag) has 73 expected environment-gated skips.
- Build and lint passed after the latest source edit. Boundary and placeholder gates passed; placeholder gate output: `✅ No placeholders detected`.
- UP1 now has its ID in an assertion-bearing test title at `web/src/pages/Login.test.tsx:29`; the test-ID inventory is 93/93. The UZ5 negative ESLint test was changed to use ESLint's API rather than a hidden temporary directory and now passes in the web suite.
- `npm run test:flake` (rerun after the latest dependency and config edits): 20/20 green across root unit, web unit, and ordinary integration targets. Each iteration reported root 433 passed / 115 skipped, web 77 passed / 0 skipped, integration 18 passed / 73 skipped.
- Week 8 archived source reproduction: at commit `a54ace6e930efa9cd72e32b07c4cdd0fc693bf1b`, `npm test` produced 317 passed / 96 skipped / 4 todo. Historical `npm ci` failed because its lockfile omitted `@matchledger/runtime`; reproduction used `npm install` in `/tmp`. `npm run test:flake -- --runs 20` on that archive failed at iteration 5/20 with `WebSocket closed before open`. The 122 Week 8-specific test subtotal remains unresolved: retained records say 104, 113, and 122, while the category table sums to 108. The original claim of 20/20 is not reproduced.
- Read-only headless browser review: login loaded at HTTP 200; demo Trader login reached `/trade` with no page errors. Current DB state renders 48 unique open orders, ACME HALF_OPEN with no trip reason, 10 bids and no asks. This is accumulated state, not a clean demo reset. No order or cancel was submitted. Screenshot: `/tmp/matchledger-trader-page.png`. This is an agent browser review, not a human sign-off; the app remains available at `http://localhost:5173/login`.
- Reducer hand-authorship cannot be certified; it was AI-written during this conversation.
- The ignored local `.env` now uses a freshly generated private JWT key; `.env.example` no longer ships a known signing key. The currently running API process was started before that local key rotation, so it must be restarted to load the new key.
- The static hardcoded-value inventory still has 1,588 rows marked UNVERIFIED across 232 source files. Targeted config/security findings are recorded in the inventory; exhaustive line-by-line semantic classification remains open.
- Historical Week 8 integration tests were also attempted with `RUN_INTEGRATION=1` and failed 7 tests; those historical tests drop `schema_migrations`, `journal`, `snapshots`, and `order_requests` in the default `postgres` database. The current demo database `matchledger_demo` still contains its rows, but no pre-run row-count baseline exists for database `postgres`. Current Week 11 integration passed 80 / skipped 11 against a temporary isolated database, which was removed after the run.

Older gate totals in this file are historical snapshots, not current verification results.

## Week 11 Test-ID Reference

Historical test-ID status summary (superseded by the latest recorded rerun below):
590 passed / 167 skipped in root, 80 passed / 11 skipped in ordinary integration, and
77 passed / 0 skipped in web. These are the prior session's recorded results, not rerun
in this shell; see the post-edit verification entry below for gate failures and limitations.

### Shared Contracts & Boundaries
| Test ID | File | Status | Coverage |
|---------|------|--------|----------|
| ZS6-ZS8 | packages/common/src/schemas.test.ts | ✅ Passing | PAGE_ROLES, zod schemas, ENDPOINT_ROLES |
| BD1 | scripts/check-boundaries.test.ts | ✅ Passing | Boundary violation detection |

### Web Library Tests
| Test ID | File | Status | Coverage |
|---------|------|--------|----------|
| UZ1-UZ4 | web/src/lib/money.test.ts | ✅ Passing | Parse/format, decimals, estimate, depth |
| UZ5 | web/src/lib/money-eslint.test.ts | ✅ Passing | ESLint rule validation |
| UG1-UG4 | web/src/auth/auth.test.ts | ✅ Passing | Route guards, auth, API client, error handling |
| UA1-UA4 | web/src/auth/auth.test.ts | ✅ Passing | Bearer header, 401 retry, problem+json, 429/503 |
| US1-US9 | web/src/state/stream.test.ts | ✅ Passing | WebSocket stream, epoch, conflation, gaps, backoff |
| UL1-UL6 | web/src/lib/lifecycle.test.ts | ✅ Passing | Status lifecycle, 202 only, hints, rejections |
| UF1-UF5 | web/src/components/forms.test.ts | ✅ Passing | Form validation, double-submit, retry, errors |

### Page Tests
| Test ID | File | Status | Coverage |
|---------|------|--------|----------|
| UP1 | web/src/pages/Login.test.tsx | ✅ Passing | Demo role buttons |
| UP2-UP6 | web/src/pages/Trading.test.tsx | ✅ Passing | Ladder, tape, entry, updates, breaker banner |
| UP7-UP8 | web/src/pages/Portfolio.test.tsx | ✅ Passing | Cash card, positions, null mark |
| UP9-UP10 | web/src/pages/OrderDetail.test.tsx | ✅ Passing | Timeline, rejection detail |
| UP11-UP12 | web/src/pages/Risk.test.tsx | ✅ Passing | Risk console, breaker table, halt/resume |
| UP13-UP14 | web/src/pages/Recon.test.tsx | ✅ Passing | Reconciliation, upload, breaks, detail |
| UP15-UP16 | web/src/pages/System.test.tsx | ✅ Passing | System page, visibility polling |

### Telemetry, Heartbeats, Recovery
| Test ID | File | Status | Coverage |
|---------|------|--------|----------|
| TL1-TL6 | packages/telemetry/telemetry.test.ts | ✅ Passing | Metrics registry, labels, server, sampling, wiring |
| HT1-HT3 | packages/api/src/system-tests.test.ts | ✅ Passing | Heartbeat writer, /system/shards, stale detection |
| RG1-RG3 | packages/api/src/system-tests.test.ts | ✅ Passing | Recovery log, /system/recovery, gauges |

### Grafana Dashboard
| Test ID | File | Status | Coverage |
|---------|------|--------|----------|
| GD1-GD3 | scripts/check-dashboard-metrics.test.ts | ✅ Passing (now actually run by `npm test`; renamed from .ts and added to vitest.config.ts's include glob) | Metrics verification, Prometheus, provisioning |

### System Endpoints, Simulator, Chaos
| Test ID | File | Status | Coverage |
|---------|------|--------|----------|
| MS1-MS4 | packages/api/src/system-tests.test.ts | ✅ Passing | /system/metrics/summary with Prometheus |
| SY1-SY2 | packages/api/src/system-tests.test.ts | ✅ Passing | /system/verify-replay, invariants |
| SM1-SM8 | packages/simulator/simulator-integration.test.ts | ✅ Passing | PRNG, FlowModel, validity, rate, backoff, scenario, endpoints, accounts |
| CH1-CH5 | packages/simulator/simulator-integration.test.ts | ✅ Passing | Kill shard, freeze shard, profile gating, recovery, demo reset |
| NP1 | scripts/check-no-placeholders.test.ts | ✅ Passing | No placeholder tests in web, including a negative proof against a seeded it.todo |

### E2E (Playwright)
| Test ID | File | Status | Coverage |
|---------|------|--------|----------|
| DEMO1-DEMO6 | e2e/demo.spec.ts | Passed in three consecutive full e2e runs: 36/36 each, including Chromium, Firefox and WebKit | Login, order flow, halt, kill, reconciliation, simulator submission |

## Week 10 Test-ID Reference (153+ tests)

| Test ID | File | Status | Notes |
|---------|------|--------|-------|
| LS1-LS3 | packages/journal/src/fenced.int.test.ts | ✅ Passing | Lease store concurrent acquisition |
| FN1-FN9 | packages/journal/src/fenced.int.test.ts | ✅ Passing | Fenced journal append, events, offsets |
| TR1-TR9 | packages/transport/src/transport.int.test.ts | ✅ Passing (unit) / ⏳ Skipped (integration) | Envelope codec, producer, consumer, startup checks, KafkaEventSink |
| OW1-OW7 | packages/shard/src/ownership-lifecycle.int.test.ts | ✅ Passing (unit) / ⏳ Skipped (integration) | Lease acquisition, revoke, recovery, fencing |
| OW1-OW6 | packages/shard/src/ownership-tests.int.test.ts | ✅ Passing (unit) / ⏳ Skipped (integration) | Ownership lifecycle, offset tickets |
| CP1-CP7 | packages/runtime/src/control-plane.int.test.ts | ✅ Passing (unit) / ⏳ Skipped (integration) | Consumer watermark skip, recovery, routing |
| CP1-CP7 | packages/runtime/src/command-routing.int.test.ts | ✅ Passing (unit) / ⏳ Skipped (integration) | Cancel/halt/resume routing |
| RD1-RD2 | packages/runtime/src/control-plane-redelivery.int.test.ts | ✅ Passing (unit) / ⏳ Skipped (integration) | Redelivery with journal lookup |
| DW1-DW4 | packages/risk/src/dedupe-bounds.test.ts | ✅ Passing | Dedupe window eviction, upcaster |
| SP1 | packages/runtime/src/transport-flag.int.test.ts | ✅ Passing | TRANSPORT=inproc/kafka composition |
| P31 | packages/system-tests/test/property-kafka.int.test.ts | ✅ Passing (unit) / ⏳ Skipped (integration) | Random flows with random kills |
| IN1-IN6 | packages/runtime/src/ingress.int.test.ts | ✅ Passing | Phase B ingress over Kafka |
| KC5, KC7 | packages/shard/src/republish.int.test.ts | ✅ Passing | Crash windows: journal commit, Kafka commit |
| HS1 | packages/system-tests/test/chaos-scaling.int.test.ts | ⏳ Framework | Hot symbol load |
| CL1 | packages/system-tests/test/chaos-scaling.int.test.ts | ⏳ Framework | Slow shard lag |
| R5, R7, R8 | packages/system-tests/test/chaos-sharding.int.test.ts | ⏳ Framework | Rebalance, freeze shard, repeated rebalances |
| R9, R10, R14 | packages/system-tests/test/chaos-ingress.int.test.ts | ⏳ Framework | Gateway crashes, broker unavailable, zombie |
| R11, R12, R13 | packages/system-tests/test/chaos-*.int.test.ts | ⏳ Framework | Event-loop stall, SIGTERM, broker restart |
| IN6 | OA1-OA15 + P30 | ⏳ Rerun | Week 9 suite with ingress enabled |

## Status Summary (Week 11 Completion)

**Historical flake checkpoint (unverified; no raw run output retained):**
- ✅ 56 test files passed consistently across all 20 runs
- ✅ 375 unit tests passed (101 skipped)
- UNVERIFIED: the old checkpoint claimed no flake and duration variance within ±2%; it has no retained run output and is not the latest Week 11 flake result.
- ✅ UI polling respects document visibility (no fixed sleeps)

**Placeholder Check:**
- ⚠️ 42 TODO comments remain in production code (expected - architectural TODOs)
- ✅ No it.todo() in implemented tests
- ✅ All Week 11 implementation complete

**Test Coverage Summary (Week 11):**
- ✅ 537 tests passing (10 new UP test scenarios)
- ✅ System endpoints: Shards, Recovery, Metrics, Verify-Replay all working
- ✅ Simulator: PRNG determinism, FlowModel, rate control, backoff verified
- ✅ Risk console: Breaker table, halt/resume with mandatory reason
- ✅ Reconciliation: Statement upload, breaks, audit trail
- ✅ System page: Real-time polling, invariants, simulator controls
- ✅ Chaos commands: Kill/Freeze shards routed via control.commands

## Status Summary (Day 7 Checkpoint)

**Unit Tests:** 505 passing, 1 todo, 0 failing
- Transport: TR1, TR4 envelope codecs ✅
- Journal: LS1-LS3, FN1-FN9 ✅
- Shard: OW1-OW7 lifecycle ✅
- Risk: DW1-DW4 dedupe bounds ✅
- Runtime: CP1-CP7, RD1-RD2, SP1, P31 ✅
- All compiling, no Week 10 placeholders ✅

**Integration Tests:** 147 skipped (need containers)
- Will pass when RUN_CONTAINERS=1
- Test framework in place, placeholders noted as expected (harness dependency)

**Week 10 Mutations:** 22 mutations defined
- FN1-FN2: Epoch checking
- FN3-FN7: Fenced writes
- TR1-TR7: Transport layer
- DW1-DW6: Deduping + ingress
- All tied to specific tests

**Remaining (Day 7):**
1. ✅ Hypothesis written in docs/SCALING.md (before E2 run)
2. ⏳ Run scripts/e2-scaling.mjs (K=1,2,4 shards, uniform + hot loads)
3. ⏳ Generate results tables in docs/SCALING.md
4. ⏳ Run mutations (scripts/mutate.mjs) and verify all killed
5. ⏳ Run npm run test:flake (20 repetitions)

## Decisions Recorded

- [x] Journal is truth, Kafka is transport
- [x] Offsets in Postgres, not Kafka
- [x] Lease ids (shard-<p>, risk-<p>), no TTL
- [x] Single-flight, fenced writes, fail-stop
- [x] Explicit partitionOf, fixed partition counts
- [x] account.events deferred (router and risk in same process)
- [x] Redelivery flag + engine journal lookup
- [x] Dedupe window policy (live + DEDUPE_WINDOW_SEQ)
- [x] Transport workspace, dependency map updated
- [x] Projector stays on journals
- [x] TRANSPORT flag (inproc|kafka) parity
- [x] Phase B: published_at, 202 durability point, GET visibility

## Limitations (documented in LIMITATIONS.md)

1. Single active control-plane (no HA)
2. Single-process risk stage (will shard in future)
3. Orders.submitted topic deferred to Phase B (done)
4. No schema registry (hardcoded envelope format)
5. No Kubernetes (docker-compose only)
6. No persistent connection pooling (per-request for tests)
7. Dedupe window unbounded (bounded in Phase B via snapshot)

## E2E runner verification — 2026-10-31 (historical; superseded below)

- Branch: `claude/relaxed-planck-kptpnk`. E2E was already listed in root workspaces; synchronized the root lockfile and pinned Playwright to installed version 1.64.1.
- Runner now uses Vite on localhost:5173, an explicit repository cwd, strict port selection, and npm workspace argument forwarding. Root Playwright config re-exports the workspace config.
- Added API readiness validation through the frontend proxy: an empty login POST must return JSON with status 400. It performs no login or database writes.
- Docker daemon access verified; started Postgres, Redis, Kafka with `docker compose up -d postgres redis kafka`; all three reported healthy via `docker compose ps`. Browser cache directories exist; browser execution remains unverified because API readiness fails first.
- `npm run build`: passed. `npm test -- --exclude scripts/check-no-placeholders.test.ts`: 577 passed, 147 skipped, zero failed. NP1 excluded because it executes git add/reset against the working index; initial sandboxed run failed and its temporary seed file was removed.
- Chromium discovery: six real demo test titles collected. `npm run test:e2e -- --project=chromium --reporter=line`: frontend started; readiness failed with HTTP 502 and ECONNREFUSED at localhost:3000. Zero browser scenarios executed; this is not a passing e2e run.
- Remaining blocker: packages/api/src/main.ts comments out database setup, runtime recovery, app construction and app.listen. Compose has no API service. Starting infrastructure alone cannot provide the backend. Demo tests also retain old credentials/selectors and need alignment after a real API is running.
- Final `npm run lint`: passed after removing the temporary test seed. Root `npx playwright test --list --project=chromium` also collected the same six tests.


## Runnable backend and demo completion — 2026-10-31

- [x] API startup composes PostgreSQL migrations, advisory ownership, journal recovery, matching/risk runtime, projector, HTTP and metrics listeners, and graceful shutdown (`packages/api/src/main.ts`, `packages/runtime/src/live-runtime.ts`).
- [x] Standalone shard uses real leases, recovery, runners, fenced journal writes, Kafka publication and a durable dead-letter path (`packages/shard/src/main.ts`, `packages/shard/src/postgres-runner.ts`). Live Kafka verification produced COMMAND, ORDER_ACCEPTED and ORDER_RESTED rows for ACME; lease ownership and recovery_log rows were observed. SIGTERM exited with code 0.
- [x] Simulator submits through Fastify injection of authenticated POST /orders, including the same validation and ownership checks (`packages/api/src/app.ts`, `e2e/demo.spec.ts`, DEMO6).
- [x] DEMO browser scenarios use seeded credentials, accessible selectors and current role navigation (`e2e/demo.spec.ts`).
- [x] Seeded-backend e2e passed three consecutive times across Chromium, Firefox and WebKit: 18/18 in 52.2s, 18/18 in 51.5s, 18/18 in 51.9s. Evidence: `/tmp/matchledger-e2e-final-1.log`, `/tmp/matchledger-e2e-final-2.log`, `/tmp/matchledger-e2e-final-3.log`; command `npm run test:e2e -- --reporter=line`. These runs cover DEMO1–5 and DEMO6, with no skips.
- Final validation: build, lint and boundaries passed; root tests 582 passed / 154 skipped; web tests 82 passed; `RUN_INTEGRATION=1 npm run test:integration` 76 passed / 4 skipped. Skipped integration tests R7, R8, R11 and R12 require the separate RUN_KAFKA_SPIKE gate and are not claimed verified by this work.
- API shutdown exited 0 and restart recovered persisted demo state. The frontend is served at http://localhost:5173; the demo API is on localhost:3000 and its metrics listener on localhost:3001.
- Scope limitation: the runnable API supports TRANSPORT=inproc and rejects Kafka mode. The standalone Kafka shard was verified independently; a complete Kafka API/control-plane composition is not implemented. Authenticated WebSocket updates currently use bounded snapshot polling. No claim is made that all Week 11 audit findings are resolved.

## Live verification checklist — 2026-10-31 (historical; superseded by completion below)

Verification only: production implementations were not changed in this pass. Added `packages/api/src/live-verification.int.test.ts`; temporary browser/chaos harnesses and raw results are under `/tmp/matchledger-*`.

- [x] Role/write refusals: all 48 forbidden catalogue pairs returned HTTP 403 with simulator and chaos routes registered (`LIVE-ROLE-MATRIX`, `/tmp/matchledger-live-verification-final.log`). The uninitialized real chaos producer is intentional: refusals must happen before dispatch.
- [x] Heartbeat behavior: old-owner heartbeat succeeds after the lease epoch advances; endpoint joins independently inserted lease, heartbeat, snapshot and journal data (`LIVE-HEARTBEAT`). Existing `HT3-live` confirms the `isStale` response and three-interval threshold.
- [x] Prometheus outage: stopped the real Compose service, observed seeded API HTTP 200 / `available:false`, then restarted it. `LIVE-PROM-DOWN` is explicitly gated by `LIVE_PROMETHEUS_DOWN=1` so normal integration runs do not require stopping monitoring.
- [x] Real shard SIGKILL/restart: ACME COMMAND / ORDER_ACCEPTED / ORDER_RESTED rows remained unchanged; four new recovery rows appeared, ACME tail length was 1 and all lease epochs advanced to 2 (`node /tmp/matchledger-shard-verify.mjs`, `/tmp/matchledger-shard-verify.log`). Broker port 39092 and a disposable SQL schema isolate this from existing consumers.
- [x] Outside-demo chaos observation: production shard remained alive with advancing heartbeats after KillShard/FreezeShard messages on the isolated broker. Qualification: `packages/shard/src/main.ts:97` subscribes only to orders.accepted, so demo chaos handling is also absent; this does not verify a functioning demo kill/freeze path.
- [ ] Recovery logging is not complete across all paths: live runtime logs matching and risk recovery; the separate control-plane recovery function has no durable recovery_log write (`packages/runtime/src/control-plane.ts:62`).
- [ ] Replay corruption requirement failed: healthy snapshot returns equal:true and a damaged checksum returns false, but changing accounts[0].cash to 999999 while retaining the original checksum returns true (`LIVE-REPLAY`, `/tmp/matchledger-live-verification-final.log`; comparison at `packages/api/src/routes/system.ts:356`). Do not treat the passing checksum test as payload-corruption coverage.
- [ ] P1–P7 are not all correct against seeded data: Portfolio displays zero/Invalid values and empty reservation fields (`web/src/pages/Portfolio.tsx:105` versus `packages/api/src/routes/accounts.ts:39`); Order Detail's events endpoint returns 500 because `getOrderTimeline` queries nonexistent risk_commands/risk_events/engine_events tables (`packages/projections/src/queries.ts:69`); Recon breaks returns 500 because it orders by nonexistent id (`packages/api/src/routes/recon.ts:183`). Browser evidence: `/tmp/matchledger-browser-verify.json`.
- [ ] Error states remain missing in Risk, Recon and System: aborted network requests show empty/default content instead of an explicit failure (`web/src/pages/Risk.tsx:73`, `web/src/pages/Recon.tsx:64`, `web/src/pages/System.tsx:97`; `/tmp/matchledger-page-states.json`). Real delayed responses show loading states; Portfolio, Order Detail and invalid login display errors. Trading displays Stale on a 1013 socket interruption (`/tmp/matchledger-trade-detail-states.json`).
- [ ] Real background-tab polling remains UNVERIFIED: controlled document visibility input stops/resumes P7 requests (2 → 2 → 3), but automation kept actual document.visibilityState visible during attempted tab changes (`/tmp/matchledger-browser-verify.json`, `/tmp/matchledger-real-visibility.json`).
- [ ] Monitoring is not provisioned: live Prometheus targets API contains only Prometheus itself; Grafana /api/search?type=dash-db returns []. Compose mounts no project configuration (`docker inspect matchledger-prometheus-1 matchledger-grafana-1`); `docker-compose.yml:58`, `ops/prometheus/prometheus.yml:11`. `node scripts/check-dashboard-metrics.mjs` passed for 24 catalogue metrics / 13 panels, but dashboard lifecycle panel uses a raw histogram, journal/apply quantiles omit rate(), and WebSocket conflation/slow-close queries are absent. Metric-name validity does not establish working panels.
- [ ] Genuine R7 failed: frozen worker's partition transferred to the other worker at epoch 2 and its queued order became durable, but the resumed worker did not exit within the 12-second observation window (`node /tmp/matchledger-r7-live.mjs`, `/tmp/matchledger-r7-live.log`). This result is independent of the old placeholder R7 test.
- [ ] Genuine R11 failed: the actual shard event loop was blocked for 310 seconds by a temporary test-only signal preload. No takeover occurred within the 340-second observation deadline, and the worker continued after unblocking. Subsequent exit code 0 was caused by an explicit cleanup SIGTERM, not automatic fencing (`/tmp/matchledger-r11-live.log`, `/tmp/matchledger-r11-cleanup.txt`). Startup does not thread session/poll timeout settings to the Kafka consumer (`packages/transport/src/consumer.ts:35`). Both isolated workers and their SQL schema were cleaned up.
- [ ] Full SP1 API parity is UNVERIFIED: `TRANSPORT=kafka node --env-file-if-exists=.env packages/api/dist/main.js` rejects startup with expected inproc (`/tmp/matchledger-kafka-api-startup.log`, `packages/api/src/startup-config.ts:10`). Independent matching-shard Kafka operation does not prove full risk/API/ledger parity.

Validation for this pass: build and lint passed; root tests 582 passed / 160 skipped (`/tmp/matchledger-live-tests.log`); web tests 82 passed (`/tmp/matchledger-live-web-tests.log`); boundaries passed; targeted live integration tests 9 passed (`RUN_INTEGRATION=1 LIVE_PROMETHEUS_DOWN=1 npx vitest run --config vitest-integration.config.ts packages/api/src/live-verification.int.test.ts packages/api/src/week11-live.int.test.ts packages/runtime/src/live-runtime.int.test.ts --reporter=verbose`). Earlier sandbox-only runs failed due to restricted sockets/subprocesses; the listed final runs used the required access. No audit report was created or updated.

Temporary Kafka verification broker `matchledger-liveverify-kafka` was removed after the probes. Demo API/frontend were preserved; Prometheus was restarted after outage checks. Final live monitoring responses are captured in `/tmp/matchledger-prometheus-targets.json` and `/tmp/matchledger-grafana-dashboards.json`. The attempted headed-browser tab check still reported visible, so actual hidden-tab behavior remains UNVERIFIED rather than failed application behavior.


## Live implementation completion — 2026-10-31

The six open areas from the previous verification pass are implemented and verified. The historical failures above remain as evidence of the earlier state; this checklist supersedes them. No audit report was created or changed.

- [x] Recovery logging and transport composition: API startup accepts inproc and Kafka modes; real accepted commands travel through orders.accepted and real engine.events drive risk notices and balanced ledger posting. Matching, risk and control-plane recovery write recovery_log rows. `SP1-live` runs the same authenticated HTTP order flow against both real binaries and compares filled order facts and account/asset ledger totals (`packages/system-tests/test/live-stack.int.test.ts`, `/tmp/matchledger-live-fixes-stack-final.log`).
- [x] Independent replay: verification replays from genesis up to the inspected snapshot sequence and validates its canonical payload. Healthy snapshots return equal:true; checksum damage, payload-only tampering and a self-consistent rechecksummed fork return false. A healthy older snapshot remains valid after a new journal command (`LIVE-REPLAY`, `/tmp/matchledger-fix-live-integration.log`).
- [x] Chaos and fail-stop: real production shards ignore KillShard/FreezeShard messages; demo shards consume FreezeShard (observed heartbeat pause and resumption) and KillShard (process exits). Session/poll timeouts are configured. Lost assignments/stale ownership fail-stop; a separate worker watchdog stops native heartbeats when the main event loop stalls. Genuine two-process R7 and R11 pass with takeover, process exit, contiguous journal sequences and takeover epochs (`CH-live`, `R7-live`, `R11-live`). All four isolated stack scenarios passed; the final run also used authenticated HTTP for demo FreezeShard/KillShard; no production broker received chaos traffic.
- [x] Browser correctness: Portfolio uses actual API names and decimal strings; share deposits and empty accounts project into real balances/positions. Trading obtains instruments from the endpoint and changes socket subscriptions when the symbol changes. Order timelines read actual journal rows with ISO timestamps and enforce trader account ownership (`LIVE-TIMELINE`). Reconciliation orders by existing columns. JSONB rejection snapshots decode; breaker counts/held funds use actual projection queries and incident clocks use journal timestamps. Risk/Recon/System show fetch errors. Unsupported per-shard queue depth was removed; the real metrics-summary queue maximum remains visible.
- [x] Actual browser state coverage: all seeded demo/page scenarios run against real endpoints. Real delayed responses test loading; aborted requests test outage states. `scripts/verify-empty-pages.mjs` creates an isolated real backend/database for empty book, portfolio/reservations, unknown order, risk, recon and system states, verifies Trading/Order Detail loading and errors, and checks production demo controls are hidden. `scripts/verify-page-visibility.mjs` uses ordinary headed Chromium/CDP with noDefaults:true: zero hidden-tab polls and polling resumes on actual tab activation. Neither helper substitutes fixture HTTP responses. Evidence: `/tmp/matchledger-empty-fixed.log`, `/tmp/matchledger-visibility-fixed.log`.
- [x] Monitoring: Compose mounts Prometheus config and Grafana provisioning. All three targets (host API metrics, shard-0, shard-1) are UP. Grafana provisions 13 panels and all 20 panel queries execute successfully; catalogue validation passes for 26 metric names (`/tmp/matchledger-monitoring-fixed.json`, `node scripts/check-dashboard-metrics.mjs`). Metrics listeners remain separate from API HTTP. Prometheus was deliberately stopped: seeded API returned HTTP 200 with available:false, then the service was restarted (`/tmp/matchledger-prom-down-fixed.json`, `LIVE-PROM-DOWN`).

Additional startup correction: clean container builds now exclude credentials, host node_modules/dist and stale TypeScript build metadata; the Node base is pinned by digest and the local shard image has an explicit week11 tag. Missing project references were added. Migration startup serializes per schema and adopts only byte-identical known migration renames; concurrent-startup and preserved-journal assertions pass (`MIG-LIVE`). `REBUILD_PROJECTIONS=1` is an explicit, advisory-lock-protected rebuild of derived tables from preserved journals. Existing migration SQL, engine-core, the ShardRunner loop, risk core and ledger core were not edited in this completion pass.

Validation evidence:

- Build and lint passed: `/tmp/matchledger-fix-build.log`, `/tmp/matchledger-fix-lint.log`.
- Root suite: 590 passed / 167 skipped; frontend suite: 77 passed / 0 skipped. Ordinary integration: 80 passed / 11 skipped. Logs: `/tmp/matchledger-fix-unit.log`, `/tmp/matchledger-fix-web.log`, `/tmp/matchledger-fix-integration.log`. Optional/gated tests remain distinct from the explicitly enabled live runs; they are not claimed passing.
- Explicit live stack: 4 passed / 0 skipped (CH-live through authenticated HTTP, SP1-live, R7-live, R11-live), 48.99s. Explicit HTTP/SQL/replay/migration/outage probes: 12 passed / 0 skipped (`/tmp/matchledger-live-fixes-stack-final.log`, `/tmp/matchledger-fix-live-integration.log`).
- Three consecutive complete e2e runs across Chromium, Firefox and WebKit: 36 passed / 0 failed / 0 skipped in each run (2.7m, 2.4m, 2.5m). Logs: `/tmp/matchledger-fixed-e2e-1.log`, `/tmp/matchledger-fixed-e2e-2.log`, `/tmp/matchledger-fixed-e2e-3.log`. After subsequent concurrent Toast UI integration and the final API restart, all 12 Chromium scenarios passed again in 32.8s (`/tmp/matchledger-latest-chromium.log`). Standalone component tests now render the real ToastProvider without weakening assertions.
- Test fixture changes align Portfolio/OrderDetail money and fields with actual HTTP contracts. The healthy replay fixture now contains a real serialized RiskCore state rather than {}. The System queue-depth assertion now checks the backed metrics summary instead of an unsupported shard column. Demo trading setup explicitly resumes its symbol, and login helpers await role navigation; scenarios remain independent across repeated/browser runs.
- `git diff --check` and boundary checks passed. Read-only protected-path diff is empty. No git write commands were run. Temporary scratch schemas and the private matchledger-livefix-kafka broker were cleaned up. API, frontend, application Kafka/Postgres/Redis, Prometheus and Grafana remain available.

Final P1 browser check also verified a disabled submit button while a real login response was delayed, followed by HTTP 401 and the visible credential error (`/tmp/matchledger-login-fixed.json`). Trading and Order Detail loading/error checks use the real isolated backend (`/tmp/matchledger-empty-fixed.log`). The visibility harness now gracefully closes Chromium and retries its own profile cleanup. Generated tracked Playwright artifacts were restored without changing source or running git write commands.

Final chaos UI correction: P7 uses the backend chaosEnabled capability and an actual owned symbol. Inproc mode no longer shows shard actions without backing routes; Kafka demo mode exposes the wired controls. The System component regression asserts the emitted /kill/ACME URL, and CH-live now invokes Freeze/Kill through authenticated HTTP rather than bypassing the API.


## Post-edit verification rerun — 2026-10-31

Historical post-edit run (superseded by the follow-up below): build, lint, boundaries passed; unit 590 passed / 167 skipped; integration 80 passed / 11 skipped; web 77 passed / 0 skipped. At that point the placeholder gate found 11 items and flake timed out at 19/20. The later checker/gate rerun below supersedes those results.

[Rebuilt assertion-aware test-ID table and every skipped result](docs/WEEK-11-TEST-INVENTORY.md): 93/93 IDs now have statically reachable assertion-bearing tests with IDs in test titles; UP1 is included in the title at `web/src/pages/Login.test.tsx:29`. Runtime status is recorded beside each matching test. Skipped test names and environment reasons are listed in the inventory.

[Value/credential/fixture/metric inventory](docs/WEEK-11-VALUE-INVENTORY.md): the original static scan contained 2,626 candidates; targeted findings were subsequently resolved: Risk now reports elapsed time, page polling shares validated config, the exported test-server builder requires a strong configured JWT secret, shard zod is exactly pinned, and projector lag names agree across helper/catalogue/dashboard. The scan is not exhaustive semantic proof; dynamically assembled values and every remaining candidate are not individually certified.

Decisions 1–18 exist. Inaccurate claims about upload size, heartbeat threshold, rejection-derived counts, automatic resume and a 1ms chaos latency bound were corrected against code. The reducer was AI-written during this conversation: hand-authorship cannot be certified. Human browser-demo review remains required. Exhaustive semantic hardcoded-value triage and all historical documentation-number provenance remain UNVERIFIED; the candidate inventory is not a completed semantic audit.

### Follow-up verification and correction — 2026-10-31

- Build passed; lint passed; root tests passed 591 / skipped 167; web tests passed 77 / skipped 0; integration tests passed 80 / skipped 11. The placeholder gate was subsequently refined to allow only test skips with an explicit nearby reason; latest gate rerun and test counts are recorded below. The prior flake run completed 20/20 green across root unit, web unit, and integration targets; integration reported 73 skipped tests per iteration.
- Three consecutive complete e2e runs each passed 36/36 across Chromium, Firefox and WebKit (DEMO1–6 and live page checks). The browser itself remains at the demo login page for human review; no browser login, order, halt or other action was performed manually by the agent.
- Loopback API and web server are running. `curl` returned HTTP 200 for `http://127.0.0.1:5173/login`; the API starts in demo profile and seeds the existing demo database. The login page is left open for the human browser review. I did not submit an order or make a trading action.
- Targeted semantic hardcoded findings listed in the value inventory were corrected. The remaining candidate inventory is not a complete proof of every literal or dynamically assembled value.
- Historical provenance: unsupported Week 8 totals/property-run/chaos totals are explicitly labeled unverified in README; the “<2%” claim has been removed as a verified flake result in `docs/decisions.md`. The old Windows dependency-tree snapshot is identified as historical in `docs/versions.md`. Archived evidence for those historical measurements is absent from this checkout, so their original truth cannot be reconstructed here.
- Reducer hand-authorship remains uncertifiable; it was AI-written during this conversation.

## Week 12 working checklist — 2026-10-31

The rows below track the numbered prompts in the supplied Week 12 prompt file. A check means implementation and required local evidence are present; partial means some requested checks or live proof are still missing. Current tally: **10 complete, 11 partial, 24 remaining**. Human-authored hypotheses, trade-offs, “does not prove” claims, pitch, VM setup, and video remain the user's work by the Week 12 rules.

| Prompt(s) | Work | How it is checked | Status |
|---|---|---|---|
| 1.1 | Full gates, container integration, e2e, cold start | `npm ci`, build/lint/unit/web/integration, 3 e2e runs; fresh-volume startup still needs a clean successful run | ◐ Partial |
| 1.2 | Topic ordering, dashboard/GD3, real CH1–CH5 evidence | `check-dashboard-metrics` reports 13 panels; GD3 panel-removal detection and the complete real-shard/journal CH proof remain open | ◐ Partial |
| 1.3 | Smoke through health/login/order/WebSocket/private-port checks | `scripts/smoke.mjs`; local app flow exists, but private-port check fails while dev services publish ports and build-SHA check is absent | ◐ Partial |
| 1.4–1.9 | Production Compose/Caddy/deploy rollback and benchmark harness | DP1/DP2 gate; previous DP9 rollback exercise; LG1/LG2/LG4/LG7 tests and renderer | ☑ Complete |
| 2.1 | Idempotent funded account seeder | LG6 unit tests and prior live seeder/idempotence run | ☑ Complete |
| 2.2 | Seeded Kafka load producer choosing active Phase B or shard-only path | LG3 tests and prior live shard-only publish; active `orders.submitted` path is not wired in the API composition | ◐ Partial |
| 2.3 | k6 arrival-rate order workload | LG5 dry run with seeded users; thresholds check errors and dropped iterations | ☑ Complete |
| 2.4 | F2/F4/F6 configs and dependency boundary proof | Config files plus BD1 seeded dependency tests and boundary gate | ☑ Complete |
| 2.5 | Prometheus measurement-window collector | Collector tests cover fixed queries and metric mapping; no experiment result files exist | ☑ Complete |
| 2.6–2.8 | F2, F4/F6, F1/F3 measured baselines | Runner and configs are present; no valid runs/results. User hypotheses must be written before measurements | ☐ Remaining |
| 3.1–3.5 | Profiles, golden traces, OP1–OP6 baseline parity | No baseline profile/result and no completed OP1–OP6 run recorded | ☐ Remaining |
| 3.6–3.7 | First optimization and measured before/after | Blocked until the user writes/commits a hypothesis and OP1–OP6 are green; core edits are user-only | ☐ Remaining |
| 4.1–4.6 | Two more optimizations, E3 table, F5 recovery chart | Blocked on committed user hypotheses, green parity gates, and result files | ☐ Remaining |
| 5.1 | CI gate/integration/e2e/docs jobs | Existing workflow has verify and integration jobs only; e2e/docs jobs and pin review remain | ◐ Partial |
| 5.2 | Backup/restore scripts and DP6 live restore | `deploy/backup.sh` and `deploy/restore.sh` are absent | ☐ Remaining |
| 5.3 | Service restart and cold-start DP4/DP5 | No complete restart-each-service and fresh-volume proof recorded | ☐ Remaining |
| 5.4 | Repo and image-history secret scan | `.env` ignore rule verified; full repo/image-history scan is not recorded | ◐ Partial |
| 5.5 | Production proxy CSP Playwright coverage | Not implemented/verified across every page | ☐ Remaining |
| 5.6 | `CHAOS_ENABLED` config and API/UI gate | Setting is absent; current gating is demo profile/command-router based | ☐ Remaining |
| 5.7 | Optional build SHA propagation | Not implemented; health response lacks a build SHA | ☐ Optional, remaining |
| 6.1 | README/result/link/checklist validator | `scripts/check-readme.mjs` is absent | ☐ Remaining |
| 6.2 | Architecture diagrams grounded in current code | Existing architecture draft is present; final Week 12 content/render review remains | ◐ Partial |
| 6.3 | README checklist and generated tables | README exists, but number traceability and all required headings are not certified | ◐ Partial |
| 6.4 | Scaling, versions, and required limitations | Existing docs are present; result-backed cross-check and all Week 12 deployment facts remain | ◐ Partial |
| 6.5 | Seeded-demo screenshots with secret review | Required screenshots are absent | ☐ Remaining |
| 7.1 | Measured-facts inventory | Gate counts and dashboard count are available; benchmark, mutation, and optimization values are UNMEASURED | ◐ Partial |
| 7.2 | Week 12 mutation set and mutation run | `tools/mutations-week12.json` is absent; no Week 12 mutation results | ☐ Remaining |
| 7.3 | Flake/e2e/placeholder/dashboard/readme final gates | Flake 20/20; three consecutive e2e runs 36/36 each; placeholder/dashboard checks pass; README checker and test-ID table still remain | ◐ Partial |

### Latest verification evidence

- `npm ci` succeeded: 372 packages installed; npm reported 10 moderate advisories. No automatic audit fix was run.
- `npm run build`, `npm run lint`, `npm run check:boundaries`, `npm run check:no-placeholders`, `npm run check:deployment`, and `node scripts/check-dashboard-metrics.mjs` passed. Dashboard check found 13 panels and catalogue-backed metrics.
- `npm test`: 607 passed, 0 failed, 167 skipped. Skip names/reasons are in [WEEK-11-TEST-INVENTORY.md](docs/WEEK-11-TEST-INVENTORY.md). `npm test --workspace @matchledger/web`: 77 passed, 0 skipped. `npm run test:integration`: 18 passed, 0 failed, 73 environment-gated skips; reasons are listed in the same inventory.
- `npm run test:flake`: 20/20 iterations green across root packages, web, and integration. Its per-iteration integration skips are the same documented opt-in cases.
- `npm run test:e2e`: three consecutive runs each passed 36/36 across Chromium, Firefox, and WebKit. Logs: `/tmp/matchledger-week12-e2e-1.log`, `/tmp/matchledger-week12-e2e-2.log`, `/tmp/matchledger-week12-e2e-3.log`.
- Fixed BD1 so it exercises seeded forbidden dependencies; fixed NP1 to invoke `process.execPath`; corrected DEMO5's locator to select a matching real shard row. Root tests passed after those edits.
- Local production-style proxy responds at `https://localhost:18443/login` with HTTP 200 and CSP/HSTS/`nosniff`. This is local TLS only, not a public deployment. Public VM/domain, smoke from outside the network, backup/restore, and reboot are not verified.
- Human review is still required for the actual browser demo. The local browser-control feature is disabled in Work settings, so I could not click through it here. The AI-written reducer's hand-authorship cannot be certified.

## Week 12 Day 1 verification — 2026-10-31

The Day 1 prompts were run against the current checkout. Commands used: `npm run build`, `npm run lint`, `npm test`, `npm test --workspace @matchledger/web`, `npm run check:boundaries`, `npm run check:no-placeholders`, `RUN_CONTAINERS=1 DATABASE_URL=postgres://postgres:matchledger@127.0.0.1:5432/matchledger_week12_integration npm run test:integration`, `npm run test:e2e`, `docker compose up -d --wait`, and `SMOKE_URL=http://127.0.0.1:3000 node scripts/smoke.mjs`. The container integration command used a newly created scratch database which was dropped after the run. Build, lint, root, web, boundaries and placeholder results were rerun after adding the smoke script.

| Gate | Result |
|---|---|
| Build / lint | Passed / passed |
| Root unit | 591 passed, 0 failed, 167 skipped; exact names and documented reasons are in [the skip inventory](docs/WEEK-11-TEST-INVENTORY.md#every-skipped-test-in-the-rerun) |
| Web | 77 passed, 0 failed, 0 skipped |
| Container integration | 69 passed, 0 failed, 22 skipped |
| E2E | 33 passed, 3 failed, 0 skipped across 36 browser-project tests; `DEMO5` fails in Chromium, Firefox and WebKit at `e2e/demo.spec.ts:96` because its exact locator matches 12 `inproc-engine` cells |
| Boundaries / placeholders | Both passed; `node scripts/check-boundaries.mjs` and `node scripts/check-no-placeholders.mjs` |

Container integration skips are all named and gated in test source: `LIVE-TIMELINE`, `LIVE-RISK`, `LIVE-ROLE-MATRIX`, `LIVE-HEARTBEAT`, `LIVE-PROM-DOWN`, `LIVE-REPLAY`, `UG-server`, `CH5-live`, `CH3-live`, `HT3-live`, `MIG-LIVE`, and `LIVE1` require the `RUN_INTEGRATION=1` describe gate, which was not set for this `RUN_CONTAINERS=1` run; `LIVE-PROM-DOWN` additionally requires `LIVE_PROMETHEUS_DOWN=1`. `SP1` and `SP1d` are explicitly skipped for the live multi-process parity harness / CI transport matrix. `R7`, `R8`, `R11`, and `R12` require `RUN_KAFKA_SPIKE=1` plus real multi-shard chaos runs. `CH-live`, `SP1-live`, `R7-live`, and `R11-live` require `RUN_LIVE_STACK=1` and private `LIVE_KAFKA_BROKERS`. Sources: `packages/api/src/live-verification.int.test.ts`, `packages/api/src/week11-live.int.test.ts`, `packages/journal/src/week11-migrations.int.test.ts`, `packages/runtime/src/transport-flag.int.test.ts`, `packages/system-tests/test/chaos-sharding.int.test.ts`, and `packages/system-tests/test/live-stack.int.test.ts`.

`docker compose up -d --wait` on the existing project completed, but it reused existing data and is not a cold-start result. Current container restart counters are 35 each for `shard-0` and `shard-1`, and 0 for Postgres, Redis, Kafka, Prometheus and Grafana (`docker inspect`). I also ran a separate project on fresh volumes and alternate ports; `up --wait` exited 0, but both shards had restarted 5 times and Kafka had no topics. Logs show `checkTopics()` failing with `'topicNames' cannot be empty`. This is a false green from Compose because shard containers have no healthcheck. The temporary project and its volumes were removed. `docker-compose.yml` only makes shards depend on healthy Postgres and Kafka; it has no topic-init service. `packages/shard/src/main.ts` calls `checkTopics` before consumer initialization, while `packages/transport/src/startup-checks.ts` calls `fetchTopicMetadata()` without topic names. Existing Kafka currently lists the required topics, but clean startup does not provision them.

Week 11 carry-over checks: **topics-before-shards: NO** for clean startup, as shown by the empty-volume run above. **Dashboard panel data: YES, 13 panels** in `ops/grafana/provisioning/dashboards/matchledger-main.json`; `node scripts/check-dashboard-metrics.mjs` validated all 13 and their catalogue metrics. **GD3 panel-removal detection: NO**; `scripts/check-dashboard-metrics.test.ts:66-80` only checks that datasource/provisioning files contain text and does not count or validate dashboard panels. **CH1-CH5 all use a real shard and journal: NO**; `packages/api/src/routes/admin.test.ts:110-120` contains truth-only assertions, `packages/simulator/simulator-integration.test.ts:53-124` models behavior in memory, and the only real journal reset probe (`packages/api/src/week11-live.int.test.ts:53`) does not start a shard. The real Kafka `CH-live` scenario exists but requires the disabled live-stack gate.

Added [scripts/smoke.mjs](scripts/smoke.mjs). Against the local API it verified `/system/health`, demo ADMIN/TRADER login, an IOC order reaching `CANCELLED`, and an authenticated `book.ACME` WebSocket snapshot. The script exits nonzero because Postgres `5432`, Kafka `29092`, Prometheus `9090`, and API metrics `3001` are reachable from the smoke host. Thus DP3 is **FAIL** on network exposure. Build-SHA matching and a production-profile chaos-route check remain unverified; the current health response in `packages/api/src/routes/system.ts:137-145` has no build-SHA field, and the local stack is in demo mode.

## Week 12 deployment and benchmark harness — 2026-10-31

- Added a production Compose override with healthchecked long-running services, a successful one-shot Kafka topic initializer ahead of API/shard startup, resource limits, bounded logs and Prometheus retention, named volumes, explicit Kafka/Node heaps, read-only application containers, and only proxy-published ports. `npm run check:deployment` validates merged config, image references, ports, resource/log policies and Caddy config; production images built successfully with Docker Compose.
- Added a Caddy production image and site config for TLS, built web assets, `/api/v1`, WebSockets, Grafana, security headers/CSP, asset/index caching, and an upload cap above the API multipart body limit. The check validates the Caddyfile with the pinned Caddy image. A temporary local TLS request returned the built login page with CSP, HSTS and `nosniff`. No real public-domain TLS issuance or upstream WebSocket session was attempted.
- Added `deploy/.env.example`, secret exclusions in `.dockerignore`, a rollback-capable `deploy/deploy.sh`, and [deployment instructions](docs/deployment.md). DP9 passed for both a deliberately failed build and an unhealthy release reusing the previous tag; the second scenario verified the original image ID was restored. Its test-only smoke wrapper verifies rollback invocation; it does not verify the live network smoke flow.
- Added the benchmark environment block and LG1 assertion test for hardware, OS/kernel, Node/Docker, container limits, git SHA/dirty flag, and dirty-tree refusal/allow marking. The built CLI refused this dirty tree without the flag and emitted a marked environment block with `--allow-dirty`. The full root suite passed 592 tests with 167 skipped; the exact skip names and reasons remain in [the Week 11 inventory](docs/WEEK-11-TEST-INVENTORY.md). Web tests passed 77. Build, lint, boundaries and placeholder gates passed. These counts are test outputs, not performance measurements.
- Deployment verification is local only. VM deployment, public DNS/TLS, backup/restore, reboot behavior, and a real public smoke test remain outstanding. The local production image build reported 10 moderate npm audit advisories; no automatic dependency changes were made. The full production Compose stack was not started from empty volumes in this task.

## Week 12 benchmark harness — 2026-10-31

- Added the exact-pinned Zod result schema with environment, warmup/measurement configuration, repetitions, counters, latency/event-loop/GC/queue/lag metrics, errors, validity reasons, and cross-field validation (`packages/benchmarks/src/results-schema.ts`). LG2 checks complete parsing and rejection of missing fields, negative values and wrong types.
- Added the injectable runner (`packages/benchmarks/src/runner.ts`). Each repetition resets state, awaits warmup and measurement windows, collects metrics, marks dropped iterations and sent/accepted/rejected mismatches invalid, and writes a non-overwriting ISO-timestamp/Git-SHA result file. LG7 verifies ordering, output writing and invalid cases. No measurement driver or benchmark result was invented or run.
- Added one-rule Markdown rendering and deterministic throughput SVG generation. LG4, RC1 and RC2 pass; `docs/experiments.md` contains begin/end markers and the renderer-generated empty state because no result JSON exists. The old historical tables remain without archived raw result files, so this does not certify that every historical number/figure can be regenerated.
- The generated block scripts were run from the npm workspace, and repository-root discovery handles that invocation correctly. `render:charts` reported no chart files because there are no result files; `render:tables` refreshed the empty generated block.
- Final validation: build, lint, boundaries and placeholder gates passed; root suite passed 599 with 167 skipped; web suite passed 77. The skip inventory remains at [docs/WEEK-11-TEST-INVENTORY.md](docs/WEEK-11-TEST-INVENTORY.md).
- Human steps remain: provision the VM, set DNS, copy and populate `deploy/.env`, run `deploy.sh`, verify the first public link, then hand-write and commit the F2, F4/E2, F5 and F6 hypotheses with thresholds/p99 targets before running those experiments. Those actions and measurements were not performed here.

## UI follow-up — 2026-10-31

- Tightened the login layout to the viewport and reduced vertical gaps without changing desktop font-size declarations. At narrow widths, the story panel collapses to the brand bar so the sign-in form and demo role buttons can fit in the available height (`web/src/theme.css`).
- Continued the landing-page adjustment toward the supplied orbit reference using MatchLedger wording, with IBM Plex font rules retained (`web/src/pages/Landing.tsx`, `web/src/theme.css`).
- Validation: `npm run build` and `npm run lint` passed; `npm test --workspace @matchledger/web` passed 82/82; `git diff --check` passed. Root `npm test` reported 594 passed, 8 failed, 174 skipped. The API failures were `listen EPERM` when test servers tried binding to `127.0.0.1`; NP1 failed while root and web test processes ran concurrently and both exercised its temporary seeded file. Browser scroll-height verification is UNVERIFIED: browser control is disabled in Work settings and Chromium launch failed with sandbox `Operation not permitted`.
- Landing visual follow-up: removed the logo medallion from behind the headline, split the MatchLedger headline across the orbit, switched the display face to an installed serif stack, and softened the orbit backdrop with a radial blur (`web/src/pages/Landing.tsx`, `web/src/theme.css`). Validation after this change: build and lint passed, web suite 82/82, `git diff --check` passed. The reference’s exact commercial font is not bundled; visual screenshot verification remains unavailable because local browser control is disabled and Chromium cannot start in this sandbox.
- Added the requested diffuse glow behind both headline lines plus a subtle letter halo, leaving the glyphs crisp (`web/src/theme.css`). Validation: `npm run build`, `npm run lint`, `npm test --workspace @matchledger/web` (82/82), and `git diff --check` passed.
- Landing hero cleanup: removed the eyebrow and supporting copy from the orbit, moved the workspace/demo actions below it, and enlarged the orbit ring (`web/src/pages/Landing.tsx`, `web/src/theme.css`). Validation: build and lint passed, web suite 82/82, `git diff --check` passed.
- Corrected orbit card orientation: orbit nodes now travel an elliptical path while staying upright; the Order node starts on the right side (`web/src/theme.css`). Validation: build and lint passed, web suite 82/82, `git diff --check` passed.
- Login artwork: replaced the wide tilted left-panel ellipses with a smaller centered circular motif and reserved vertical space to prevent text/capability overlap (`web/src/theme.css`). Validation: build and lint passed, web suite 82/82, `git diff --check` passed.
- Login artwork follow-up: enlarged the orbital rings after review showed the previous circles read too small (`web/src/theme.css`). Validation: build and lint passed, web suite 82/82, `git diff --check` passed.
- Login artwork follow-up: animated the three surrounding icons along the left-panel ellipse while keeping each icon upright and pausing on hover (`web/src/theme.css`). Validation: build and lint passed, web suite 82/82, `git diff --check` passed.
- Aligned login icon motion to the tilted orbit: icons now follow a path in a track rotated to match the rings, with each icon counter-rotated to remain upright (`web/src/pages/Login.tsx`, `web/src/theme.css`). Validation: build and lint passed, web suite 82/82, `git diff --check` passed.
- Added a repository-root Vercel config so deployment installs npm workspaces, builds `@matchledger/web` (including its `@matchledger/common` TypeScript dependency), and publishes `web/dist` (`vercel.json`). The web workspace build succeeded locally; a Vercel deployment has not yet been triggered.
- Added matching Vercel build settings for a project rooted at `web`: `npm run build` runs the TypeScript project-reference build before Vite and publishes `dist` (`web/vercel.json`). This directly addresses the observed `npx vite build` failure; deployment must use this setting and run after the config is pushed.
- Excluded colocated test files from production TypeScript project builds in web, common, and engine-core. Vercel installs the web workspace dependencies only, so compiling tests there incorrectly required root-only `fast-check`; unit tests remain executed by Vitest. Root `npm run build` and `npm run lint` passed; web tests passed 82/82.
- Full deployment recheck: root build/lint, boundaries and placeholder gates passed; full root suite passed 609 with 167 gated skips; container integration passed 69 with 22 gated skips; DP1/DP2 deployment config check passed. Against the local production-style Compose stack via Caddy TLS, demo login returned 200 in 416ms and authenticated WebSocket delivered `book.ACME` snapshot at seq 1. Public Vercel behavior remains unverified from this environment; set `VITE_WS_URL` in Vercel to the direct `wss://<actual-render-api-host>/ws` endpoint to bypass Vercel's WebSocket proxy path, and keep the Render API on an always-on plan for predictable login latency.

## Vercel SPA route fallback — 2026-11-01

- Confirmed `https://matchledgerr-web.vercel.app/` and its built JS/CSS assets return HTTP 200, while `/login` returns HTTP 404. Added a final SPA fallback rewrite to `/index.html` in both Vercel configs, after the API and WebSocket rewrites, so direct loads and refreshes of React Router routes resolve to the app. Build, lint, full root tests (609 passed, 167 skipped), and `npm run check:deployment` passed. The live domain needs a new deployment before this fix takes effect.

## Demo Trading page activity — 2026-11-01

- Demo-profile API startup now idempotently ensures demo users/accounts/funds and starts the existing backend simulator, so Trading has live-generated activity without manually opening System first. The simulator resolves the actual seeded simulator user ID, and its model centers generated prices on the configured risk reference; this keeps limit orders inside the default risk band instead of basing them on half of a much larger instrument max price. Orders still use the validated `/orders` path; no fake rows were added to the web client. Build and lint passed; full root tests passed (610 passed, 167 skipped). A live backend restart/deployment is still required; hosted order-book/trade output has not yet been verified.
