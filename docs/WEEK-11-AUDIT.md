# Week 11 Audit Report

**Status:** **FAIL** - Multiple violations found  
**Date:** 2026-10-20  
**Auditor:** Verification pass (read-only)

---

## STEP 1: Gate Results

| Gate | Status | Output |
|------|--------|--------|
| `npm ci` | FAIL | Dependency resolution error (dependencies already present, proceeding with local npm) |
| `npm run build` | **PASS** | TypeScript compilation clean, 0 errors |
| `npm run lint` | **PASS** | ESLint 0 errors, 0 warnings |
| `npm run check:boundaries` | **PASS** | "Dependency boundaries verified for all workspaces." |
| `npm run check:no-placeholders` | **WARN** | TODO comments found in `packages/system-tests/src/chaos-child.ts:56` (legitimate stub) |
| `npm test` | **PASS** | 574 tests passed, 147 skipped, 88 test files passed, 26 skipped |
| `npm run test:integration` | **PASS** | 20 tests passed, 53 skipped, 5 test files passed, 10 skipped |
| `npm run test:flake` | **PASS** | 20/20 green (no flake detected) |
| E2E Tests | **UNVERIFIABLE** | Configuration files exist (`e2e/package.json`, `e2e/playwright.config.ts`) but require Docker + running services to execute |

### Test Execution Results (Unit Tests)
- **Test Files:** 88 passed, 26 skipped (114 total)
- **Tests:** 574 passed, 147 skipped (721 total)
- **Duration:** 5.89s

### Integration Test Results
- **Test Files:** 5 passed, 10 skipped (15 total)
- **Tests:** 20 passed, 53 skipped (73 total)
- **Duration:** 681ms

### Flake Test (20 consecutive runs)
- **Result:** 20/20 green
- **No flake detected**

### E2E Test Status
- **Config:** ✅ Present (`e2e/playwright.config.ts`)
- **Package.json:** ✅ Present (`e2e/package.json`)
- **Test File:** ✅ Present (`e2e/demo.spec.ts`)
- **Executable:** ❌ UNVERIFIABLE - Requires Docker + running backend services

---

## STEP 2: Test-ID Coverage

| Test ID | File | Line | Status | Notes |
|---------|------|------|--------|-------|
| ZS6 | packages/common/src/schemas.test.ts | 20 | ✅ PASS | PAGE_ROLES consistency |
| ZS7 | packages/common/src/schemas.test.ts | 40 | ✅ PASS | Zod schema round-trip |
| ZS8 | packages/common/src/schemas.test.ts | 70 | ✅ PASS | ENDPOINT_ROLES validation |
| BD1 | scripts/check-boundaries.test.ts | 12 | ✅ PASS | Boundary checker test |
| UZ1 | web/src/lib/money.test.ts | 6 | ✅ PASS | Money parse/format round-trip |
| UZ2 | web/src/lib/money.test.ts | 52 | ✅ PASS | Display formatting |
| UZ3 | web/src/lib/money.test.ts | 73 | ✅ PASS | Estimate calculation |
| UZ4 | web/src/lib/money.test.ts | 89 | ✅ PASS | Cumulative depth |
| UZ5 | web/src/lib/money-eslint.test.ts | 12 | ✅ PASS | ESLint rule |
| UG1-4 | web/src/auth/auth.test.ts | 25-150 | ✅ PASS | Route guards (4 tests) |
| UA1-4 | web/src/auth/auth.test.ts | 160-300 | ✅ PASS | API client tests (4 tests) |
| US1-9 | web/src/state/stream.test.ts | 15-400 | ✅ PASS | Stream reducer (9 tests) |
| UL1-6 | web/src/lib/lifecycle.test.ts | 20-150 | ✅ PASS | Lifecycle (6 tests) |
| UF1-5 | web/src/components/forms.test.ts | 25-200 | ✅ PASS | Form validation (5 tests) |
| UP1-10 | web/src/pages/Login.test.tsx, Trading.test.tsx, Portfolio.test.tsx, OrderDetail.test.tsx | 25-200 | ✅ PASS | Page tests (10 tests) |
| UP11-16 | web/src/pages/Risk.test.tsx, Recon.test.tsx, System.test.tsx | 28-129 | ✅ PASS | Page tests (6 tests) |
| TL1-6 | packages/telemetry/telemetry.test.ts | 20-250 | ✅ PASS | Telemetry (6 tests) |
| HT1-3 | packages/api/src/system-tests.test.ts | 150-300 | ✅ PASS | Heartbeat tests (3 tests) |
| RG1-3 | packages/api/src/system-tests.test.ts | 310-400 | ✅ PASS | Recovery log (3 tests) |
| GD1-3 | scripts/check-dashboard-metrics.ts | 20-80 | ✅ PASS | Dashboard validators (3 tests) |
| MS1-4 | packages/api/src/system-tests.test.ts | 410-550 | ✅ PASS | Metrics summary (4 tests) |
| SY1-2 | packages/api/src/system-tests.test.ts | 560-650 | ✅ PASS | System verify (2 tests) |
| SM1-8 | packages/simulator/simulator-integration.test.ts | 20-400 | ✅ PASS | Simulator (8 tests) |
| CH1-5 | packages/simulator/simulator-integration.test.ts | 410-600 | ✅ PASS | Chaos (5 tests) |
| DEMO1-5 | e2e/demo.spec.ts | 25-200 | ⚠️ EXISTS | Playwright tests exist but not executable without Docker |
| NP1 | packages/engine-core/src/index.test.ts | 2 | ✅ PASS | InstrumentSpec export |

**Summary:** 88/93 test IDs found (94.6%)  
**Missing:** 5 DEMO tests (E2E tests using Playwright, not Jest `it()`)

---

## STEP 3: Stub and Placeholder Hunt

### Critical Findings

| File | Line | Issue | Severity | Justification |
|------|------|-------|----------|---------------|
| packages/api/src/routes/recon.ts | 102, 121, 192 | `return reply.code(200).send([])` - Empty array responses | ⚠️ STUB | Endpoints not fully implemented, should query database |
| web/src/pages/Dashboard.tsx | 517 | Hard-coded `http://localhost:3001` Grafana URL | ❌ VIOLATION | URL should be configurable or from environment |
| packages/api/src/main.ts | 28-71 | 13 TODO comments outlining startup steps | ⚠️ FRAMEWORK | Legitimate startup checklist, not blocking |
| packages/api/src/ws/gateway.ts | 26, 78, 88, 96, 105 | 5 TODO comments in WebSocket gateway | ⚠️ STUB | Gateway implementation incomplete |

### Placeholder Search Results

- ✅ No `it.todo` found in production code
- ✅ No `describe.skip` found (only `describe.skipIf()` for conditional gating)
- ✅ No `xit` or `xdescribe` found
- ✅ No `.only` found in tests
- ✅ No `throw new Error("unimplemented")` found
- ⚠️ TODO comments found (see table above, mostly legitimate)

---

## STEP 4: Hard-coded Values

| Value | Location | Current | Status | Issue |
|-------|----------|---------|--------|-------|
| HEARTBEAT_MS | packages/shard/src/shard-host.ts:16 | `process.env.HEARTBEAT_MS ?? "5000"` | ✅ PASS | Configurable |
| PENDING_HINT_MS | web/src/lib/lifecycle.ts:15 | `export const PENDING_HINT_MS = 3000` | ✅ PASS | Properly defined |
| Grafana URL | web/src/pages/Dashboard.tsx:517 | `http://localhost:3001` | ❌ FAIL | Hard-coded, should be configurable |
| Prometheus URL | packages/api/src/routes/system.ts:201 | `http://localhost:9090` | ⚠️ WARN | Default is fine if overridable |

### Configuration Verification
- ✅ PROFILE env var read from config (packages/shard/src/main.ts)
- ✅ DEDUPE_WINDOW_SEQ configurable (packages/shard/src/main.ts:31)
- ✅ Metrics ports separate (telemetry-server.ts)
- ❌ Grafana URL hard-coded in component
- ✅ No demo passwords outside seed script

---

## STEP 5: Real Implementation Checks

### a. stream-state.ts (web/src/state/stream-state.ts)
- **Epoch change handling:** ✅ Line 87-93, triggers refetch
- **Conflated snapshots:** ✅ Line 66-69, replaces state with flag
- **Gaps (user.*, breaker, etc):** ✅ Line 72-78, triggers refetch
- **Non-contiguous book seq:** ✅ Line 81-84, applies without refetch
- **Lower-seq ignore:** ✅ Line 81, checks `seq > lastSeq`
- **Disconnect/reconnect:** ✅ Handled by useSocket hook
- **Close codes:** ✅ 4401 (logout), 1013 (resync), 1001 (reconnect) in useSocket
- **Purity check:** ✅ No Date.now(), fetch, DOM, random detected
- **US8 property test:** ⚠️ UNVERIFIED - US8 test exists but cannot confirm property-based with logged seed without running

### b. lifecycle.ts (web/src/lib/lifecycle.ts)
- **Pure function:** ✅ No side effects detected
- **FILLED beats CANCEL_REQUESTED:** ✅ Line 84-89, terminal states handled
- **202 never "success":** ✅ `grep -r '"success"' web/src` returns 0 hits in components
- **Test UL2:** ✅ Confirms 202 shows "durably received, not yet accepted"

### c. Money codec
- **No parseFloat/Number on money:** ✅ grep returns 0 in web/src production code
- **Estimate uses bigint:** ✅ web/src/lib/money.ts line 12-15
- **MARKET no estimate:** ✅ Test UZ3 line 80-87 verifies

### d. Auth
- **Token in sessionStorage only:** ✅ web/src/auth/auth.ts line 45
- **No token in URLs:** ✅ WebSocket URL constructed without token (line 78)
- **401 refresh once:** ✅ web/src/utils/apiClient.ts lines 30-55, one retry configured

### e. Guards (PAGE_ROLES vs ENDPOINT_ROLES)
- **PAGE_ROLES defined:** ✅ packages/common/src/schemas.ts
- **Matches ENDPOINT_ROLES:** ✅ ZS6 test verifies consistency
- **Server refuses wrong role:** ⚠️ UNVERIFIED - Cannot test without running API

### f. Telemetry
- **Metrics registry:** ✅ packages/telemetry/src/catalogue.ts
- **Label rules:** ✅ TL2 test verifies forbidden labels throw
- **/metrics and /healthz only:** ✅ telemetry-server.ts lines 20-35
- **Metrics port separate:** ✅ Not exposed on public port

### g. Heartbeats
- **Unfenced upsert:** ✅ packages/shard/src/shard-host.ts line 349-358, ON CONFLICT DO UPDATE without lease check
- **/system/shards joins correctly:** ✅ packages/api/src/routes/system.ts lines 94-132
- **Stale threshold 3 intervals:** ✅ Line 106, 15 seconds = 3 * 5000ms

### h. recovery_log
- **Written by recovery paths:** ✅ packages/shard/src/shard-host.ts line 379-400
- **Row structure:** ✅ lease_id, duration_ms, snapshot_seq, tail_length, symbols_recovered

### i. /system/metrics/summary
- **Fixed PromQL allowlist:** ✅ Hardcoded queries
- **No client input:** ✅ Verified in code
- **Prometheus down returns 200:** ⚠️ UNVERIFIABLE - Requires Prometheus to test

### j. /system/verify-replay
- **Real implementation:** ✅ packages/api/src/routes/system.ts:242-306
- **Returns equal: true/false:** ✅ Line 291
- **Checksum matching:** ✅ Line 286

### k. Simulator
- **mulberry32 PRNG:** ✅ packages/simulator/src/flow-model.ts
- **No Math.random/Date.now in model:** ✅ grep returns 0
- **Same seed → identical orders:** ✅ SM1 test verifies
- **Tick grid and lot multiples:** ✅ SM3 property test
- **Uses submit path:** ✅ Same path as POST /orders

### l. Chaos and demo reset
- **404 outside PROFILE=demo:** ⚠️ UNVERIFIABLE - Cannot test without running API
- **Demo reset not touching journals:** ⚠️ UNVERIFIABLE - Requires execution
- **Idempotent:** ⚠️ UNVERIFIABLE - Requires execution

### m. Pages P1-P7
- **Load from real endpoints:** ⚠️ UNVERIFIABLE - Requires running API
- **Loading/empty/error states:** ⚠️ UNVERIFIABLE - Component render only, no API call
- **P7 polls only while visible:** ✅ UP16 test line 85-129 verifies
- **Demo controls in demo profile:** ⚠️ UNVERIFIABLE - Requires execution

### n. Grafana dashboard
- **Metrics in catalogue:** ⚠️ UNVERIFIABLE - No Grafana JSON found
- **Panels from spec 4.13:** ⚠️ UNVERIFIABLE - No Grafana JSON found
- **Prometheus targets UP:** ⚠️ UNVERIFIABLE - Requires running Prometheus

### o. Migrations 017 & 018
- **Migration 017:** ✅ packages/journal/migrations/017_system_endpoints.sql exists
- **Migration 018:** ✅ packages/journal/migrations/018_verify_replay_support.sql exists
- **Apply to clean DB:** ⚠️ UNVERIFIABLE - Requires database execution

---

## STEP 6: Protected Code - Diff Since Week 10

**Command:** `git diff HEAD~1 -- packages/engine-core packages/shard/src/shard-runner.ts packages/risk/src/core packages/ledger/src/ledger.ts`

- ✅ **engine-core:** No diffs found
- ✅ **ShardRunner:** No diffs in run loop
- ✅ **risk core:** No diffs found
- ✅ **ledger core:** No diffs found

All protected code unchanged. ✅ PASS

---

## STEP 7: Regression Testing

### Week 9 & 10 Test IDs
- OC1: ✅ PASS (packages/api/src/openapi.test.ts)
- OC2: ✅ PASS (packages/api/src/openapi.test.ts)
- RBM: ✅ PASS (tested by route guard tests)
- MT1: ✅ PASS (packages/system-tests/src/money.test.ts)
- E2E1, E2E2: ⚠️ UNVERIFIABLE (require execution)
- SP1: ✅ PASS (tested in both TRANSPORT modes)
- R7, R11: ✅ PASS (integration tests)

**Regression status:** ✅ PASS (no test file changes, all accessible tests still pass)

---

## STEP 8: Mutation Testing

**File:** `tools/mutations-week11.json`  
**Status:** ✅ File exists with 25 mutations from spec section 8.11

**Mutation Test Execution:** ⚠️ UNVERIFIABLE - Requires mutation framework execution to verify survivors

---

## STEP 9: Documentation Honesty

| Item | Status | Evidence |
|------|--------|----------|
| docs/decisions.md entries 1-18 | ✅ PASS | All 18 entries present |
| README limitations accurate | ✅ PASS | Single API instance, no mobile layout noted |
| docs/versions.md dependencies | ✅ PASS | All Week 11 packages listed with exact versions |
| PROGRESS.md test-ID table | ✅ PASS | Comprehensive table matches Step 2 |
| Numbers with evidence | ⚠️ WARN | Some numbers lack run evidence (e.g., /system endpoint behaviors) |

---

## Summary Violations

**Count:** 10 violations found

1. **Hard-coded Grafana URL** - web/src/pages/Dashboard.tsx:517 (`http://localhost:3001`)
2. **Empty array stub endpoints** - packages/api/src/routes/recon.ts:102, 121, 192
3. **WebSocket gateway incomplete** - packages/api/src/ws/gateway.ts (5 TODO comments)
4. **E2E tests not executable** - Require Docker + running services
5. **TODO in main.ts** - Startup checklist (13 comments, framework-level)
6. **Grafana dashboard JSON missing** - Cannot verify metrics against catalogue
7. **Prometheus config unverified** - Cannot verify targets
8. **System endpoint behaviors unverifiable** - Requires running API + Prometheus
9. **Chaos behavior unverifiable** - Requires execution with PROFILE=demo
10. **Demo reset idempotency unverifiable** - Requires database state inspection

---

## Manual Verification Checklist

The following require human testing:
- [ ] Run E2E tests 3 times with `npm run test:e2e` (requires Docker stack)
- [ ] Test `/system/metrics/summary` with Prometheus down (stop prometheus, curl endpoint)
- [ ] Verify Grafana dashboard has all panels from spec 4.13
- [ ] Test chaos endpoints outside PROFILE=demo (should return 404)
- [ ] Confirm demo reset is idempotent (run twice, check journal row count)
- [ ] Verify stream-state.ts handles all gap scenarios with actual WebSocket events
- [ ] Test auth 401 refresh with invalid token
- [ ] Run migrations 017-018 against fresh database

---

## Verdict

**FAIL** - 10 violations found:
- 1 critical (hard-coded URL)
- 3 high (stub endpoints, incomplete gateway)
- 6 medium (unverifiable without execution environment)

Cannot declare PASS without:
1. Fixing hard-coded Grafana URL
2. Removing or completing stub endpoints
3. Running full integration tests with Docker stack
4. Manual verification of system endpoint behaviors
