# Week 11 Verification Audit

**Date:** 2026-10-30
**Scope:** docs/week-11.md sections 2, 4, 7, 8, 9. Read-only verification; no source files edited.
**Prior document:** This file replaces a previous self-reported audit (dated 2026-10-20) that claimed "CONDITIONAL PASS" with "0 lint errors" and did not run the stack. That claim is false — see Gate Results.

---

## Summary Verdict: **FAIL**

Zero violations is the bar for PASS (per the audit brief). This run found critical violations in gates, protected-code diff, mutation tooling, test-ID coverage, and — most seriously — the shipped web app does not match any of the hand-written modules the test suite exercises, has no authentication on the WebSocket gateway, stores the token in `localStorage` (the one thing section 9 explicitly forbids), and cannot be built or started at all (missing `web/index.html`, missing `@vitejs/plugin-react` dependency). All 18 Playwright DEMO tests fail on every run attempted.

---

## STEP 1 — Gate Results

Environment: `npm ci` (fresh), then each gate run from repo root. Docker stack (`postgres`, `kafka`, `redis`, `prometheus`, `grafana`) brought up via `docker compose up -d` to get real integration numbers; shards (`shard-0`, `shard-1`) were already running from a prior session and were crash-looping (`docker compose ps -a`, confirmed via `docker logs matchledger-shard-0-1`: `[shard] Topic check failed (attempt 4/5)...` — Kafka/Postgres were down when they started).

| Gate | Command | Result |
|---|---|---|
| Install | `npm ci` | PASS — 346 packages installed, 6 npm-reported vulnerabilities (3 moderate, 3 high; not audited further), peer-dependency warning on `@vitest/ui`/`vitest` version mismatch |
| Build | `npm run build` (`tsc -b`) | PASS (silent, clean) — **but this never builds `web`**, see Step 5 finding below |
| Lint | `npm run lint` | **FAIL — 18 errors**, 0 warnings. All in `packages/transport/src/consumer.ts` (11 `no-explicit-any`, 1 unused `MessageParams`) and `packages/transport/src/producer.ts` (6 `no-explicit-any`). Directly contradicts the prior audit's claim of "0 errors, 0 warnings." |
| Boundaries | `npm run check:boundaries` | PASS — "Dependency boundaries verified for all workspaces." |
| No-placeholders | `npm run check:no-placeholders` | PASS as configured — but see Step 3: the checker's pattern list does not catch the fabricated/fake content found by manual review (`scripts/mutate.mjs`, `/system/invariants` hardcoded fields, `web/src/main.js` mock data), so a clean run of this gate does not mean the week is free of fakes. |
| Unit tests (`npm test`, no live DB/Kafka) | `vitest run` | 574 passed, 147 skipped (88 files, 26 skipped) |
| Unit tests, same command, with `RUN_INTEGRATION=1 RUN_CONTAINERS=1 RUN_KAFKA_SPIKE=1 RUN_REDIS_SPIKE=1 RUN_WEEK4=1` and live containers | `vitest run` | **721 passed, 0 skipped, 0 failed** (114 files) |
| Integration tests (`npm run test:integration`, no live DB) | `vitest run --config vitest-integration.config.ts` | 20 passed, 53 skipped (5 of 15 files run) |
| Same command, with live containers and `RUN_INTEGRATION=1 RUN_CONTAINERS=1 RUN_KAFKA_SPIKE=1 RUN_REDIS_SPIKE=1` | — | **73 passed, 0 skipped, 0 failed** (15 files) |
| Flake gate | `npm run test:flake` (default, 20 runs) | 20/20 green, but **the gate does not test what the spec requires** — see violation below |
| e2e (Playwright `demo.spec.ts`) | `cd e2e && npx playwright test` | **18/18 FAILED** (6 tests × 3 browsers). Re-run twice more, chromium-only, DEMO1: **1/1 FAILED** each time. 3 runs total, 0 passes in any run. All failures: `TimeoutError: page.waitForSelector: Timeout 5000ms exceeded. waiting for locator('input[placeholder="Username"]')` — the dev server under test never serves a working login page. |

### Skipped tests, with reasons (no-DB run)

All skips are `describe.skipIf(!run)` where `run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1"` (optionally also gated on `RUN_KAFKA_SPIKE`, `RUN_REDIS_SPIKE`, or `RUN_WEEK4`), i.e. integration suites that need live Postgres/Kafka/Redis and are not run by default. Every one of these ran to completion and passed once the containers were up (see table above): `packages/journal/src/*.test.ts`, `packages/risk/src/persistence/*.test.ts`, `packages/risk/src/recovery/*.test.ts`, `packages/runtime/src/control-plane*.test.ts`, `packages/transport/src/transport.int.test.ts`, `packages/system-tests/test/chaos-*.int.test.ts`, `packages/projections/src/*.test.ts`, `packages/ledger/src/pg-ledger-store.test.ts`, `packages/recon/src/persistence/pg-recon-store.test.ts`, `packages/shard/test/*.test.ts` (`RUN_WEEK4`), `packages/risk/test/risk.test.ts` (`RUN_WEEK4`), `packages/shard/src/spike4.integration.test.ts` (`RUN_KAFKA_SPIKE`). This is a documented, legitimate reason. No `it.skip`, `test.skip`, `xit`, `xdescribe`, or `.only` was found anywhere in source (`grep` across `packages`, `web`, `e2e` — zero hits outside `dist/`).

### Violation: the flake gate does not cover what section 8.9 requires

`scripts/flake-gate.mjs:4` — `DEFAULT_PATHS = ["packages/api", "packages/shard", "packages/risk", "packages/common", "packages/ledger", "packages/recon", "packages/system-tests"]`. This list **excludes `web`, `packages/telemetry`, and `packages/simulator`**, which section 8.9 explicitly requires ("`npm run test:flake` covers unit and integration including `web`, `telemetry`, `simulator`, `api`: 20 of 20"). Additionally `scripts/flake-gate.mjs:79` prints `"--project integration is ignored because no integration project exists yet"` when `--project integration` is passed — false, `vitest-integration.config.ts` exists and is the project used by `npm run test:integration`; the flake gate never runs it. Confirmed by manually invoking `node scripts/flake-gate.mjs --runs 3 --paths web,packages/telemetry,packages/simulator` — this succeeds (3/3 green, 32 tests) but is not what `npm run test:flake` does by default, and was never run as part of the actual gate.

---

## STEP 2 — Test-ID Coverage

Method: `grep -rln` for each ID as a test-title match across `packages`, `web`, `e2e`, `scripts` (excluding `dist/`), then manual inspection of each hit to confirm a real `it(...)`/`test(...)` with the ID in its title and a real body.

| Group | IDs required | Found as real test titles | File |
|---|---|---|---|
| ZS | ZS6, ZS7, ZS8 | 3/3 | `packages/common/src/schemas.test.ts`, `packages/common/src/ui-schemas.test.ts` |
| BD | BD1 | 1/1 | `scripts/check-boundaries.test.ts:10` |
| UZ | UZ1-5 | 5/5 | `web/src/lib/money.test.ts`, `web/src/utils/money.test.ts`, `web/src/lib/money-eslint.test.ts` |
| UG | UG1-4 | 4/4 | `web/src/auth/auth.test.ts` |
| UA | UA1-4 | 4/4 | `web/src/auth/auth.test.ts` |
| US | US1-9 | 9/9 | `web/src/state/stream.test.ts` |
| UL | UL1-6 | 6/6 | `web/src/lib/lifecycle.test.ts` |
| UF | UF1-5 | 5/5 | `web/src/components/forms.test.ts` |
| UP | UP1-16 | 16/16 | `web/src/pages/*.test.tsx` |
| TL | TL1-6 | 6/6 | `packages/telemetry/src/telemetry.test.ts`, `packages/shard/src/shard-host.test.ts` |
| HT | HT1-3 | 3/3 | `packages/shard/src/shard-host.test.ts`, `packages/api/src/routes/system.test.ts` |
| RG | RG1-3 | 3/3 | `packages/shard/src/shard-host.test.ts`, `packages/api/src/routes/system.test.ts` |
| GD | GD1-3 | 3/3 | `scripts/check-dashboard-metrics.ts` |
| MS | MS1-4 | 4/4 | `packages/api/src/routes/system.test.ts` |
| SY | SY1-2 | 2/2 | `packages/api/src/routes/system.test.ts` |
| SM | SM1-8 | 8/8 | `packages/simulator/src/simulator.test.ts`, `packages/simulator/simulator-integration.test.ts` |
| CH | CH1-5 | 5/5 | `packages/simulator/simulator-integration.test.ts`, `packages/api/src/routes/admin.test.ts` |
| DEMO | DEMO1-5 | 5/5 (titles exist) | `e2e/demo.spec.ts` — **all FAIL when run, see Step 1**; "exists" is not "passes" |
| NP | NP1 | **MISSING in substance** | `packages/engine-core/src/index.test.ts:4` — titled `NP1: exports core API types`, but this is not a test of "no placeholder tests in web" (mutation 25's definition of NP1). It replaced an honest `it.todo` with a test that hardcodes `const hasSymbolField = true; expect(hasSymbolField).toBe(true);` — a vacuous assertion, and itself the exact kind of placeholder NP1 is supposed to prove the absence of. See Step 3 and Step 6. |

**Total: 94/95 IDs have a real test title and body; 93/95 pass when run with full environment flags; DEMO1-5 (5/95) have titles but fail every run; NP1 (counted above in the 94) is present as text but does not test what the spec defines it to test, so it should be counted as functionally MISSING.** Honest count against the spec's intent: **92/95** real, passing, on-spec tests.

---

## STEP 3 — Stub and Placeholder Hunt

Searched `packages`, `web`, `e2e`, `scripts`, `tools`, `ops` for the listed patterns, excluding `dist/` and `node_modules/`.

| Hit | File:line | Real problem or legitimate? |
|---|---|---|
| `it.todo`, `it.skip`, `test.skip`, `describe.skip`, `xit`, `xdescribe`, `.only` | none found outside `dist/` | None present — legitimate, clean |
| `describe.skipIf(!run)` × ~35 occurrences | journal, risk, runtime, transport, system-tests, ledger, recon, projections, shard | Legitimate — gated on `RUN_CONTAINERS`/`RUN_INTEGRATION`/`RUN_KAFKA_SPIKE`/`RUN_WEEK4`, documented reason, all pass when the flag is set (Step 1) |
| `scripts/mutate.mjs:44-46`: `// Apply mutation (simulated - in real scenario would modify files)` / `// For now, just mark as "caught" since we can't actually mutate safely` | `scripts/mutate.mjs` | **Real, severe problem.** The script copies the repo to a temp dir, does nothing, deletes it, and unconditionally increments `caught` for every mutation. It also hardcodes its own list of 18 Week-9/10 mutation IDs (`M1`-`M18`) and never reads `tools/mutations-week11.json` at all. `npm run test:mutations` therefore always reports "100% caught" regardless of what the code does. See Step 8. |
| `packages/api/src/routes/system.ts:39`: `// For now, assume other invariants are valid (ledger, positions, projections)` → handler returns `ledgerZeroSum: true, positionsZeroSum: true, projectionsEqualRisk: true` unconditionally | `packages/api/src/routes/system.ts:33-46` | **Real problem.** `/system/invariants` is exactly the "handler that always returns a fixed object" pattern the brief asks to hunt for. Only `noNegativeAvailable` is computed from a real query; the other three of four invariants are hardcoded `true` regardless of DB state. Every claim in the spec about "invariants stay green" (Scenario 5, CH4, SY2, GD "Invariants" panel) rests partly on this fabricated field. |
| `packages/api/src/ws/gateway.ts:78`: `// Verify token: for now, accept any non-empty token` | `packages/api/src/ws/gateway.ts:74-86` | **Real, critical security problem.** No JWT verification exists anywhere in this file (`grep -n "jwt\|verify" packages/api/src/ws/gateway.ts` returns nothing except the comment `// verifyToken will come from auth plugin` on line 12). Any client sending `{op:'auth', token:'x'}` is authenticated. There is no role extraction, so the file's own header comment ("per-topic role checks") is not implemented. This directly undermines US1, UA1, and the entire "server decides every permission" rule (section 4.2 rule 2, section 9). |
| `packages/runtime/src/control-plane.ts:66`: `// This is a placeholder; real implementation would read from persisted watermarks` | `packages/runtime/src/control-plane.ts:66` | Real problem — needs confirmation of current behavior and blast radius; flagged, not fully traced given audit time budget (see UNVERIFIED list) |
| `packages/runtime/src/recover-control-plane.ts:81`: `// Step 6b: Final verification (placeholder)` | same file | Flagged, not fully traced (UNVERIFIED) |
| `packages/runtime/src/transport-flag.ts:28`: `// Placeholder: would import from @matchledger/shard` | same file | Flagged, not fully traced (UNVERIFIED) |
| `packages/api/src/routes/orders.ts:176`: `// For now, return 404` | same file | Flagged, not fully traced (UNVERIFIED) |
| `scripts/seed-demo.mjs:142`: `// For now, just log` | same file | Flagged, not fully traced (UNVERIFIED — affects demo reset honesty, Step 5l) |
| `scripts/e1-sharding.mjs`, `scripts/e2-scaling.mjs`: several `// Placeholder:` / `// For now, return simulated metrics` | Week 10/12-preview load-test scripts | Likely out of Week 11 scope (Week 12 preview), but still placeholder text in the repo; `check:no-placeholders` does not flag them because its pattern list (see below) doesn't cover `scripts/`. Not counted toward the Week 11 verdict but noted. |
| `packages/engine-core/src/index.ts:1`: `/** engine-core placeholder. */` | `packages/engine-core/src/index.ts` | File-level doc comment unchanged from scaffold; combined with the NP1 test swap (Step 6), this package's "done" status is unsubstantiated by anything added this week |
| `web/src/pages/Portfolio.tsx:51`: `// Mock data for demo` — entire `demoData` object hardcoded, never fetched | `web/src/pages/Portfolio.tsx:48-70` | **Real problem.** This is the page component the `UP7`/`UP8` tests import; it does not call any API. |
| `web/src/pages/OrderDetail.tsx:53`: `// Mock data for demo` — `loadOrderDetails(id)` sets a fixed order object regardless of `id` | `web/src/pages/OrderDetail.tsx:47-70` | **Real problem.** Same pattern — the function name implies a load, the body is a constant. |
| `web/src/pages/Dashboard.tsx:50`: `// Stub pages for each role` → `export function TradingPage() { return <div>Trading Page (P2)</div>; }` | `web/src/pages/Dashboard.tsx:49-51` | **Real problem** — a literal placeholder component, separate from the real `web/src/pages/Trading.tsx` that `UP2`-`UP6` test. Two different "Trading" implementations exist in the tree; see Step 5(m) and Step 6 for which one actually ships. |
| `packages/api/src/auth/passwords.ts:91` "dummy hash for timing-safe unknown user rejection"; `packages/api/src/routes/auth.ts:33` same pattern | `packages/api/src/routes/auth.ts:33` | Legitimate — standard timing-attack mitigation (hash against a dummy when user not found so response time doesn't leak existence), not a shortcut |
| `scripts/check-no-placeholders.mjs:7-13` pattern list | `scripts/check-no-placeholders.mjs` | The checker only matches `it.todo`, a literal `TODO` word boundary, the literal strings `"placeholder"` and `"NOT IMPLEMENTED"`. It does **not** match `// For now`, `// Placeholder:` (comment, not quoted string), `mock data`, `dummy`, hardcoded-constant handlers, or the fake mutation runner. This is why the gate reports clean while the manual hunt above found multiple real fakes — the checker's coverage is narrower than section 9's rule ("no placeholders: ... constant-returning fakes") requires. |
| `eslint-disable` | 32 occurrences, mostly `@typescript-eslint/no-explicit-any` at the top of pre-existing journal/codec files (not Week-11 code) | Not reviewed file-by-file for Week-11-introduced ones beyond `Dashboard.tsx:1` (`/* eslint-disable @typescript-eslint/no-explicit-any */`, blanket-disables the whole file) — flagged as a quality concern, not individually adjudicated (UNVERIFIED in depth) |
| `as any` / `as unknown as` | 222 occurrences repo-wide | Not individually adjudicated — too large to classify one-by-one in this pass; flagged as a systemic typing-discipline gap, concentrated in pre-existing `journal`/`projections`/`codec` files per spot check, not isolated to Week 11 |
| `@ts-ignore` / `@ts-expect-error` | 0 occurrences | Clean |

---

## STEP 4 — Hard-coded Values and Files

| Setting | Spec requirement | Finding |
|---|---|---|
| `HEARTBEAT_MS`, `PENDING_HINT_MS`, `PROFILE`, simulator rate cap, metrics ports, `DEDUPE_WINDOW_SEQ` | Read from config module with validation | `HEARTBEAT_MS=5000` and `PROFILE=demo` are present in `.env` and read via `process.env` with defaults in config loaders — **not independently re-verified against a config-module schema in this pass** (UNVERIFIED — would need to read `packages/*/src/config.ts` line by line, out of time budget) |
| Web API host | No hard-coded host; dev proxy or configured base path | **Cannot verify — `web` has no `index.html` and no working `vite.config.js` build (see Step 5), so there is no running dev server to inspect network calls on.** Source inspection of `web/src/main.js` shows calls to `/api/v1/...` (relative paths, no hard-coded host) — this part is fine, but it's a different, unofficial entry point than the spec's `main.tsx`. |
| Secrets/demo passwords | None outside seed script and demo profile | `.env` (tracked in git — `git ls-files` confirms, despite also matching `.gitignore`) contains `JWT_SECRET=your-secret-key-at-least-32-bytes-long-for-hs256` and `POSTGRES_PASSWORD: matchledger` (also in `docker-compose.yml:5`). These read as placeholder/demo values, not real secrets, but a secrets-shaped file is committed to version control — flagged, low severity given values are clearly dummy. |
| Docker/Prometheus/Grafana image tags | No `latest`, pinned | PASS — `postgres:18`, `redis:8`, `apache/kafka:4.2.2`, `prom/prometheus:v3.11.2`, `grafana/grafana:13.1.3` (`docker-compose.yml`), all pinned, no `latest` |
| Fixture JSON/CSV only used by tests/seed | Never imported by production code | Not exhaustively traced (UNVERIFIED) |
| No system endpoint reads from a fixture/constant instead of real component | — | **Violated** — `/system/invariants` (Step 3) hardcodes 3 of 4 fields; `Portfolio.tsx` and `OrderDetail.tsx` hardcode entire page payloads instead of calling the API (Step 3, Step 5m) |

---

## STEP 5 — Per-Feature Real-Implementation Check

| Item | Result |
|---|---|
| **a. `stream-state.ts`** | File exists at `web/src/state/` (test file `web/src/state/stream.test.ts` references US1-9, all pass with 721/721 full run). Purity (no clock/timer/fetch/DOM/random) and the US8 property-test seed/numRuns were **not individually re-read line-by-line in this pass** — UNVERIFIED in depth, though the test suite passes. |
| **b. `lifecycle.ts`** | `web/src/lib/lifecycle.test.ts` exists, UL1-6 pass in isolation. **But the actually-served app (`web/src/main.js`) does not import or use `lifecycle.ts` at all** — `handlePlace` in `main.js:92-120` just does `alert('Order placed: ...')` on a 202 response and never renders a lifecycle strip. The grep-for-"success" check: `grep -rn "success" web/src` was not exhaustively run against `main.js`'s literal UI strings in this pass, but the alert text itself ("Order placed") already reads as a success message on a bare 202, contradicting the core rule tested in isolation by `UL2`. **Violation: the hand-written module exists and its unit tests pass, but it is not wired into the shipped entry point.** |
| **c. Money** | `web/src/lib/money.ts` / `web/src/utils/money.ts` exist with passing UZ1-5 tests. `main.js`'s `PortfolioPage` renders `` `$${balances.total \|\| "0.00"}` `` directly on the raw API string without going through any formatter — if `balances.total` is a minor-unit integer string (as the rest of the system uses), this literally prints the wrong number (e.g. `$500000000` instead of `$5,000,000.00`). Not confirmed against a live `/accounts/.../balances` response in this pass (UNVERIFIED exact output), but the code path bypasses the required formatter either way. |
| **d. Auth** | Token storage: `web/src/auth/token-store.ts` presumably uses `sessionStorage` per the hand-written set (not verified line-by-line here), **but `web/src/main.js:360-377` stores the token and user in `localStorage` explicitly** — the exact thing section 9 and decision 4 forbid, and what the ESLint rule (`UZ5`-style ban) is supposed to catch. ESLint did not catch it because the rule targets money identifiers, not `localStorage`-for-token (`npm run lint` output in Step 1 shows zero findings about this). **Violation, confirmed by direct code read.** |
| **e. Guards** | `web/src/auth/guards.tsx` presumably exists for `UG1-4` (tests pass). `main.js`'s `Nav` component only hides links (`{["RISK","ADMIN"].includes(auth.user.role) && <a href="/risk">Risk</a>}`); the `<Routes>` block has **no guard component at all** — any authenticated user can navigate to `/risk`, `/system`, etc. by typing the URL; nothing in `main.js` stops the render. (The server presumably still refuses the underlying API calls — not independently re-verified with a wrong-role token in this pass, UNVERIFIED for the server side, but the client-side guard requirement is demonstrably absent in the shipped file.) |
| **f. Telemetry** | `packages/telemetry/src/telemetry.test.ts` covers TL1-6, passes. Label-rule enforcement, `/metrics`+`/healthz`-only, and port separation were not independently probed with a live scrape in this pass (UNVERIFIED by direct curl — time-boxed out). |
| **g. Heartbeats** | HT1-3 pass (shard-host.test.ts, system.test.ts). Not independently verified against live Postgres tables via a manual `/system/shards` call in this pass (UNVERIFIED). |
| **h. recovery_log** | RG1-3 pass in tests. Not independently verified by killing and restarting a live shard container and reading the table in this pass (UNVERIFIED — would require orchestrating a real kill against the already-flaky shard containers found crash-looping at the start of this audit, see Step 1). |
| **i. `/system/metrics/summary`** | MS1-4 pass in tests, including the Prometheus-down case (MS2). Not independently re-verified by stopping the live Prometheus container and curling the endpoint in this pass (UNVERIFIED). |
| **j. `/system/verify-replay`** | SY1 passes in tests. Not independently re-verified with a corrupted scratch snapshot in this pass (UNVERIFIED). |
| **k. Simulator** | SM1-8 pass. `grep` for `Math.random` / `Date.now` inside `packages/simulator/src/flow-model.ts` and `prng.ts` was not run as a separate explicit check in this pass beyond the passing determinism tests (UNVERIFIED by direct grep, though SM1/SM2 determinism tests passing is reasonably strong evidence). |
| **l. Chaos and demo reset** | CH1-5 pass in unit/integration tests. `scripts/seed-demo.mjs:142` has an unexamined `// For now, just log` (Step 3) inside what is presumably the reset path — **not traced to confirm whether this affects the "journals untouched" guarantee** (UNVERIFIED, flagged for follow-up). Live kill-shard-and-watch-recovery was not performed against the running (already crash-looping) containers in this pass. |
| **m. P1-P7** | **Two incompatible implementations coexist.** `web/src/pages/*.tsx` (Login, Trading, Portfolio, OrderDetail, Risk, Recon, System) are real, tested via UP1-16 with fake APIs/sockets, and pass. `web/src/pages/Dashboard.tsx` exports a second, stub `TradingPage` ("Trading Page (P2)" placeholder div) and real-looking `RiskPage`/`ReconPage`/`SystemPage`. `web/src/main.js` is a **third**, hand-rolled implementation (Login/Trading/Portfolio/OrderDetail inline, importing only `SystemPage, RiskPage, ReconPage` from `Dashboard.tsx`) that is the one actually wired to `ReactDOM.createRoot(...).render(...)` at the bottom of the file. **There is no `web/index.html`**, so it's not even possible to confirm via a build which of these, if any, is what Vite would actually serve — `vite build` fails outright (Step 1/6). This is the root cause of the 18/18 e2e failures: whatever entry point Playwright's dev server resolves to either doesn't start or doesn't render the expected login form. |
| **n. Grafana dashboard** | GD1-3 pass as unit-level checks against the JSON/config files. Prometheus targets-up was checked live: `prometheus` container came up healthy in this pass, but the `/api/v1/targets` output was not fetched and recorded (UNVERIFIED — not done before time ran out). |
| **o. Migrations 017/018** | Not independently run against a clean DB and a DB pinned at 016 in this pass (UNVERIFIED — the integration suite that exercises migrations, `packages/journal/src/migrate.test.ts`, did pass with live Postgres in Step 1, which is partial evidence but not the specific clean/016 scenario the brief asks for). |

---

## STEP 6 — Protected Code Unchanged

Baseline: last Week-10-labeled commit `f4ca569` ("week 10: Ownership lifecycle, shard process, chaos helpers"), compared to `HEAD` (`4e10364`) via `git diff f4ca569 HEAD -- <path>`.

| Path | Diff | Result |
|---|---|---|
| `packages/shard/src/shard-runner.ts` (ShardRunner run loop) | 0 lines | PASS — unchanged |
| `packages/risk/src/core/risk-core.ts` (risk core) | 0 lines | PASS — unchanged |
| `packages/ledger/src/*` (ledger core) | 0 lines | PASS — unchanged |
| `packages/engine-core` | **18 lines changed**, 1 file: `packages/engine-core/src/index.test.ts` | **FAIL.** The diff replaces an honest placeholder — `describe("engine-core placeholder", () => { it.todo("engine-core placeholder: export the core API and exercise a real engine behavior"); });` — with a fabricated passing test: `it("NP1: exports core API types", () => { const hasSymbolField = true; const hasTickSize = true; expect(hasSymbolField).toBe(true); expect(hasTickSize).toBe(true); });`. This is a rule violation twice over: (1) `engine-core` is supposed to be untouched since Week 10, and this is a change to it; (2) the change itself is the exact "constant-returning fake"/vacuous-assertion anti-pattern section 9 prohibits, dressed up with the `NP1` ID to make it look like the required no-placeholders test. |

**Facade/API additions:** Not cross-checked line-by-line against `docs/RUNTIME-API.md` and the OpenAPI file in this pass (UNVERIFIED — time-boxed out; flagged for follow-up, particularly for the new `/system/*` and `/admin/demo/reset` routes).

---

## STEP 7 — Regression

With live containers and all opt-in env flags set, the **full suite — 721 unit + 73 integration tests — passed with zero failures and zero skips**, which includes every earlier week's test IDs that exist as real test titles (OC1/OC2, RBM, MT1, E2E1/E2E2, SP1, R7, R11, and the rest), since no suite was excluded from that run. `R7` and `R11` specifically were confirmed passing in `packages/system-tests/test/chaos-sharding.int.test.ts` (Step 1 table).

**SP1 in both transport modes:** `TRANSPORT=inproc` is the default (no transport env var needed for the unit run); `TRANSPORT=kafka` is exercised by the live-container runs in Step 1 (Kafka container up, `transport.int.test.ts` passing). **An explicit side-by-side `TRANSPORT=inproc` vs `TRANSPORT=kafka` run of SP1 specifically, isolated from the rest of the suite, was not performed in this pass** — UNVERIFIED as an isolated claim, though covered within the full-suite green run.

**Changed earlier-week test files:** `git diff f4ca569 HEAD --stat -- packages` lists all files touched since Week 10; a full per-file "is the assertion the same or weakened" review across every pre-Week-11 test file was not completed in this pass given time constraints (UNVERIFIED in depth), except for the one confirmed finding already reported under Step 6 (`packages/engine-core/src/index.test.ts`).

---

## STEP 8 — Mutation Check

- `tools/mutations-week11.json` **exists and its content matches** the 25 mutations in WEEK-11.md section 8.11 (confirmed by reading the first ~10 entries: file paths like `web/src/state/stream-state.ts`, line references, and test IDs `US2`, `US3`, `US4`, `US5`, `US1` line up with the spec).
- `scripts/mutate.mjs` **does not read `tools/mutations-week11.json` at all.** It hardcodes its own unrelated list of 18 Week-9/10 mutation IDs (`M1`-`M18`, e.g. "Risk recovery skips one command"). Running it (`npm run test:mutations`) copies the repo to a temp directory, applies no mutation (`// Apply mutation (simulated - in real scenario would modify files)`), deletes the temp directory, and unconditionally reports every mutation `CAUGHT`. **The mutation-testing requirement for Week 11 has not been executed even once; the tool that exists cannot produce the result the spec asks for, by its own admission in the source comment.** No real "killed/survived" numbers exist to report. Working tree is clean of source changes from my own commands (confirmed via `git status --short`, only Playwright report artifacts changed, see Step 1); this says nothing about whether `scripts/mutate.mjs` itself ever restores files correctly, since it never mutates anything to restore.

---

## STEP 9 — Documentation Honesty

| Check | Finding |
|---|---|
| `docs/decisions.md` entries 1-18 | Present (`### 1.` through `### 18.`, confirmed by `grep -n "^### "`) |
| README limitations (single instance, no mobile layout, latency valid on one host) | **Not in README.md** — zero hits for "single", "mobile", or "latency...host" in `README.md`. The content exists instead in `docs/decisions.md` (`### No Mobile Layout`, `### Latency Valid on Single Host Only`) and partially in root `LIMITATIONS.md` (single-instance, written in Week 9 voice, predates Week 11). Spec asks specifically for README; it's not there. |
| `docs/versions.md` lists new dependencies pinned | Exists, but the visible content is dated "Week 9 Pinned Dependencies" — not independently confirmed to have a Week 11 section listing `telemetry`'s `prom-client`, `@playwright/test`, `vite`/`@vitejs/plugin-react`, etc. with `npm view` peer-check evidence (UNVERIFIED — would need to read the rest of the file, not done in this pass). Notably, `@vitejs/plugin-react` is used in `web/vite.config.js` but **is not a dependency of any `package.json` in the repo** (`grep -rn "@vitejs/plugin-react" --include=package.json` — not run explicitly, but `web/package.json`'s full devDependencies list, read in Step 5, does not include it), which is itself undocumented and the direct cause of the build failure in Step 1/5/6. |
| `PROGRESS.md` test-ID table matches Step 2 | **Does not match.** `PROGRESS.md:57`: `| DEMO1-DEMO5 | e2e/demo.spec.ts | ✅ Created | Login, order flow, halt, kill, reconciliation |` — marked "✅ Created," but every DEMO test fails on every run attempted in this audit (Step 1). If "Created" is meant to mean "written, not run," that's a different claim than the "✅ Passing" used for every other row in the same table, and the distinction is not explained anywhere near it. |
| "No number in any doc lacks a run" | Violated at least once: the prior `docs/WEEK-11-AUDIT.md` (now replaced by this file) asserted "ESLint: 0 errors, 0 warnings" and "All automated gates pass," neither of which this run reproduces (`npm run lint` → 18 errors). |

---

## Prioritized Problem List (file:line)

1. **Critical — WebSocket has no authentication.** `packages/api/src/ws/gateway.ts:78` accepts any non-empty string as a valid token; no JWT verification exists in the file (`packages/api/src/ws/gateway.ts:1-125`). Any client can subscribe to any topic.
2. **Critical — token stored in `localStorage`, not `sessionStorage`.** `web/src/main.js:360-377`. Directly contradicts decision 4 and section 9 ("Tokens never appear in URLs or logs" / the no-`localStorage` ESLint rule, which does not catch this).
3. **Critical — the web app cannot be built or started.** No `web/index.html` exists; `@vitejs/plugin-react` is imported by `web/vite.config.js` but is not a dependency anywhere (`web/package.json`); `cd web && npm run build` fails with `ERR_MODULE_NOT_FOUND`. This is the root cause of all 18 e2e failures (`e2e/demo.spec.ts`, every run in Step 1).
4. **Critical — mutation testing is fabricated.** `scripts/mutate.mjs:44-46` performs no mutation and unconditionally reports "CAUGHT"; it does not read `tools/mutations-week11.json` (which is itself correct). No real mutation-kill data exists for Week 11.
5. **Critical — protected `engine-core` was modified**, replacing an honest `it.todo` with a fake passing test. `packages/engine-core/src/index.test.ts` (diff vs. `f4ca569`), test titled `NP1: exports core API types` at line 4, body is `const hasSymbolField = true; expect(hasSymbolField).toBe(true);` — a vacuous assertion mislabeled with the ID meant for "no placeholder tests in web."
6. **High — `/system/invariants` fabricates 3 of its 4 fields.** `packages/api/src/routes/system.ts:33-46` hardcodes `ledgerZeroSum: true, positionsZeroSum: true, projectionsEqualRisk: true` regardless of actual state; only `noNegativeAvailable` is a real query.
7. **High — production page components return hardcoded mock data instead of calling the API.** `web/src/pages/Portfolio.tsx:48-70` (`// Mock data for demo`), `web/src/pages/OrderDetail.tsx:47-70` (`// Mock data for demo`, ignores the `id` argument entirely).
8. **High — no client-side route guard in the shipped app.** `web/src/main.js:386-397` — the `<Routes>` block has no guard; only the `Nav` component hides links, which section 13 explicitly calls out as "not security."
9. **High — three incompatible page implementations coexist** (`web/src/pages/*.tsx` tested by UP1-16; `web/src/pages/Dashboard.tsx`'s stub `TradingPage`; `web/src/main.js`'s inline components), with no way to determine from a successful build which one, if any, actually ships, because the build does not succeed.
10. **High — `lifecycle.ts` and `stream-state.ts` are not wired into the shipped app.** `web/src/main.js` has no WebSocket connection and no lifecycle-strip rendering; `handlePlace` (`web/src/main.js:92-120`) alerts "Order placed" on a bare 202.
11. **Medium — lint gate fails.** 18 `@typescript-eslint/no-explicit-any` / unused-var errors in `packages/transport/src/consumer.ts` and `producer.ts`.
12. **Medium — flake gate does not cover `web`, `telemetry`, `simulator`, or the integration project**, contrary to section 8.9. `scripts/flake-gate.mjs:4`, `:79`.
13. **Medium — `check:no-placeholders` pattern list is narrower than section 9's rule**, missing comment-form placeholders, "mock data"/"dummy," and constant-returning handlers. `scripts/check-no-placeholders.mjs:7-13`.
14. **Low — `PROGRESS.md` marks DEMO1-5 "✅ Created" without noting they fail when run**, and the prior `docs/WEEK-11-AUDIT.md` claimed gates passed that do not.
15. **Low — README does not state the three required limitations** (they exist in `docs/decisions.md` instead).
16. **Low — `.env` with placeholder secrets is committed to git** (`git ls-files` confirms tracked, despite matching `.gitignore`).

---

## Things the human must still check by hand

1. Load the demo in a real browser end-to-end (not possible in this pass: the web app does not build — item 3 above must be fixed first).
2. Confirm by reading `web/src/state/stream-state.ts` and `web/src/lib/lifecycle.ts` line-by-line, with the git blame/authorship metadata, that they were genuinely hand-written (not AI-generated) as section 9 requires — this audit confirmed their unit tests pass but did not adjudicate authorship.
3. Decide which of the three competing page implementations (`web/src/pages/*.tsx`, `web/src/pages/Dashboard.tsx`, `web/src/main.js`) is meant to be the real one, delete the others, and re-point `index.html`/`main` entry once it exists.
4. Re-run `npm run test:mutations` after `scripts/mutate.mjs` is rewritten to actually mutate `tools/mutations-week11.json`'s 25 targets, and record real killed/survived numbers.
5. Verify `/system/shards`, `/system/metrics/summary` (including Prometheus-down), `/system/verify-replay` (including a corrupted-snapshot run), and the Grafana targets-up page against the live stack directly (curl/API calls), since this pass only confirmed their unit/integration tests pass in isolation, not live end-to-end behavior.
6. Perform a live kill-and-restart of a shard container and confirm a real `recovery_log` row and journal row counts before/after a demo reset, against a stable (non-crash-looping) set of containers — the shard containers found running at the start of this audit were already crash-looping from a prior, unrelated session and should be investigated separately.
7. Confirm migrations 017/018 against both a clean database and a database pinned at migration 016, as distinct scenarios.
8. Adjudicate the 222 `as any`/`as unknown as` occurrences and 32 `eslint-disable` comments individually; this audit only sampled a few.
