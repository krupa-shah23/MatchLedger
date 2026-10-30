# Week 11 Audit

Audited commit: `c95e1f2` (branch `claude/relaxed-planck-kptpnk`), run at 2026-10-30T18:17Z in a container with no Docker daemon, no live Postgres/Kafka/Redis/Prometheus, and no Playwright browsers installed. Every claim below cites the command run, or a file:line, or a test name. Anything that needed live infrastructure this container does not have is marked **UNVERIFIED** with the reason.

## Summary verdict: **FAIL**

Zero violations is required for PASS; this run found violations in Steps 1, 2, 3, 4, 5, 6, 7, 8 and 9. Headline reasons (full detail below):

- `npm run build` fails (1 TS error), `npm run check:boundaries` fails (1 forbidden dependency), `npm run check:no-placeholders` fails (14 hits).
- `e2e` cannot run at all: it is not in the npm workspaces list so root `npm ci` never installs it, and its own `webServer` command is broken independent of that (`npm run dev --workspace web` run from `e2e/`'s cwd fails with "No workspaces found").
- `GD1`, `GD2`, `GD3`, `BD1`, `NP1` and `DEMO1`-`DEMO5` (8 of 93 required IDs) are never executed by `npm test`/`npm run test:integration` at all.
- `NP1` no longer exists as a test title anywhere in the repo (Step 6 below).
- `packages/engine-core` (protected) has a non-empty diff since the Week 10 commit.
- `scripts/check-dashboard-metrics.mjs`, run directly, finds 11 `ml_` metrics in the Grafana dashboard that do not exist in `METRICS_CATALOGUE`.
- `/system/verify-replay` does not replay into a scratch engine; it recomputes a checksum of the already-stored snapshot JSON.
- 11/25 mutations in `tools/mutations-week11.json` survive `scripts/mutate.mjs`.
- `web/package.json` depends on both `react-router` (forbidden, undocumented in `docs/versions.md`) and `react-router-dom`.
- `README.md` has no limitations section and is 38 lines, still headed "Week 8 Complete".

---

## Step 1: Gate results

| Gate | Command | Result |
|---|---|---|
| Install | `npm ci` | PASS. "added 368 packages... 6 vulnerabilities (3 moderate, 3 high)". `npm audit` not run further (not asked). |
| Build | `npm run build` | **FAIL.** `web/src/router.tsx(69,32): error TS2339: Property 'env' does not exist on type 'ImportMeta'.` One error, one file. |
| Lint | `npm run lint` | PASS. `eslint .` → no output, exit 0. |
| Boundaries | `npm run check:boundaries` | **FAIL.** `node scripts/check-boundaries.mjs` → `Dependency boundary check failed: - web/package.json: dependencies.react-router is forbidden (allowed: @matchledger/common, react, react-dom, react-router-dom, @tanstack/react-query)`. |
| No-placeholders | `npm run check:no-placeholders` | **FAIL.** 14 hits, listed in Step 3. |
| Unit tests | `npm test` | 570 passed, 0 failed, 147 skipped (717 total), 88 files passed / 26 skipped (114). `Duration 14.53s`. |
| Integration tests | `npm run test:integration` | 20 passed, 0 failed, 53 skipped (73 total), 5 files passed / 10 skipped (15). `Duration 1.60s`. |
| web unit tests | `cd web && npx vitest run` | 80 passed, 0 failed, 14 files passed (0 skipped). Not part of `npm test` — root `vitest.config.ts` only includes `packages/**/*.test.ts`, so `npm test` never runs `web/`'s suite at all; it has to be invoked separately. |
| e2e | `cd e2e && npx playwright test --project=chromium` | **BLOCKED**, 3/3 runs failed identically: `[WebServer] npm error No workspaces found: --workspace=web` → `Error: Process from config.webServer was not able to start. Exit code: 1`. Root cause: `e2e/playwright.config.ts`'s `webServer.command` is `npm run dev --workspace web`, but it runs with `cwd` = `e2e/`, whose own `package.json` has no `workspaces` field, so npm looks for a workspace named `web` relative to `e2e/` and finds none. This is independent of and in addition to: (a) `e2e` is not listed in the root `package.json`'s `workspaces` (`["packages/*", "web"]`), so `npm ci` at the repo root never installs `e2e/node_modules` — it had to be installed separately (`cd e2e && npm ci`, "added 3 packages"); (b) no Playwright browsers are installed (`~/.cache/ms-playwright` does not exist) even if the webServer problem were fixed; (c) no Docker daemon (`docker ps` → "failed to connect to the docker API ... no such file or directory"), so Postgres/Kafka/the API are not running for `demo.spec.ts` to call. |
| Flake gate | `npm run test:flake` | **20/20 green**, after rewriting `scripts/flake-gate.mjs` this session to actually run `web`'s suite and the integration config (previously it silently skipped both — see the commit `c95e1f2` message). Each of the 20 iterations ran unit(root)+unit(web)+integration and all passed. Full log at `/tmp/flake-output.txt` in this container. |

### Skipped tests (Step 1 detail)

Zero bare/undocumented skips exist: `grep -rn "\bit\.skip(\|\btest\.skip(\|\bdescribe\.skip(\|\bxit(\|\bxdescribe(\|\.only(" packages web --include="*.test.ts" --include="*.test.tsx"` → no matches anywhere in the repo. Every one of the 147 (unit) + 53 (integration) skips is a `describe.skipIf(...)` gated on an env var that this container does not set:

- Unit run, grouped by file (147 total, via `vitest run --reporter=json` + JSON parse): 14 `packages/shard/test/shard-runner.test.ts`, 12 `packages/journal/src/fenced.int.test.ts`, 12 `packages/risk/src/recovery/recover-risk-partition.test.ts`, 9 `packages/ledger/src/pg-ledger-store.test.ts`, 8 `packages/transport/src/transport.int.test.ts`, 8 `packages/risk/src/persistence/pg-risk-journal.test.ts`, 8 `packages/recon/src/persistence/pg-recon-store.test.ts`, 7 `packages/journal/src/pg-journal.test.ts`, 7 `packages/risk/test/risk.test.ts`, 6 `packages/shard/src/ownership-tests.int.test.ts`, 6 `packages/risk/src/persistence/risk-snapshot-store.test.ts`, and 20 more files each contributing 1-4 (full list in `/tmp/unit-report.json` captured this run).
- Reason, by file, confirmed by reading the gate condition: `const run = process.env.RUN_CONTAINERS === "1" || process.env.RUN_INTEGRATION === "1";` (e.g. `packages/journal/src/fenced.int.test.ts:9`, `packages/ledger/src/pg-ledger-store.test.ts:10`, `packages/transport/src/transport.int.test.ts:11`, `packages/system-tests/test/chaos-ingress.int.test.ts:8`) — these need a live Postgres/Kafka this container doesn't have.
- `packages/shard/test/shard-runner.test.ts:35` uses a **different, oddly-named** flag: `describe.skipIf(...process.env?.RUN_WEEK4 !== "1")("ShardRunner", ...)`. The gate works (documented reason: needs live infra), but naming a Week-11-era test's live-infra flag `RUN_WEEK4` is stale/confusing — flagged in the problem list.
- Integration run (53 total): same files/reasons, subset of the above (`packages/journal/src/fenced.int.test.ts` 12, `packages/transport/src/transport.int.test.ts` 8, `packages/shard/src/ownership-tests.int.test.ts` 6, `packages/journal/src/recovery.int.test.ts` 4, `packages/runtime/src/control-plane.int.test.ts` 4, `packages/system-tests/test/chaos-ingress.int.test.ts` 4, `packages/system-tests/test/chaos-sharding.int.test.ts` 4, and 4 more files).

Conclusion: every skip in Steps 1's two runs is documented by its own `skipIf` condition — none is a "skip without a documented reason" by the letter of that rule — but **every single one is a live-infra skip in this run**, meaning a large fraction of the suite (147+53 instances) was not actually exercised in this audit pass.

---

## Step 2: Test-ID coverage

93 IDs required (ZS6-8, BD1, UZ1-5, UG1-4, UA1-4, US1-9, UL1-6, UF1-5, UP1-16, TL1-6, HT1-3, RG1-3, GD1-3, MS1-4, SY1-2, SM1-8, CH1-5, DEMO1-5, NP1). Built by cross-referencing `vitest --reporter=json` output from the three JSON reports (`/tmp/unit-report.json`, `/tmp/int-report.json`, `/tmp/web-report.json`, 870 test results total) against a `grep -rnoE '(it|test)\(\s*["'"'"'][A-Z]+[0-9]+' packages web scripts e2e` sweep for titles.

**85/93 have a real test title with a real body that runs under `npm test`/`npm run test:integration`/web's `npx vitest run`. 8/93 are MISSING from any executed run**, 3 of those because the file that defines them isn't included in any npm test command at all, and 5 because `e2e` cannot run (Step 1).

| ID | File:line | Status |
|---|---|---|
| ZS6 | `packages/common/src/ui-schemas.test.ts:17,49`; `packages/common/src/schemas.test.ts:6` | passing (7 instances) |
| ZS7 | `packages/common/src/ui-schemas.test.ts:25,71`; `packages/common/src/schemas.test.ts:24,51` | passing (3) |
| ZS8 | `packages/common/src/ui-schemas.test.ts:35,83`; `packages/common/src/schemas.test.ts:63` | passing (7) |
| BD1 | `scripts/check-boundaries.test.ts:10` | **MISSING from any run** — real test exists, but `scripts/` is not matched by root `vitest.config.ts`'s `include: ["packages/**/*.test.ts"]`, so `npm test` never runs it. Ran it directly: `npx vitest run scripts/check-boundaries.test.ts` → 1 passed. So the test itself is real and passes, but is excluded from the gate. |
| UZ1 | `web/src/lib/money.test.ts:6,19,33` (vacuous dup, see Step 3) + `web/src/utils/money.test.ts:10,50` (real) | passing (11) |
| UZ2 | `web/src/lib/money.test.ts:52,66` (vacuous dup) + `web/src/utils/money.test.ts:18,63` (real) | passing (3) |
| UZ3 | `web/src/lib/money.test.ts:73,80` (vacuous dup) + `web/src/utils/money.test.ts:26,74` (real) | passing (3) |
| UZ4 | `web/src/lib/money.test.ts:89` (vacuous dup) + `web/src/utils/money.test.ts:33,79` (real) | passing (9) |
| UZ5 | `web/src/lib/money-eslint.test.ts:12` | passing |
| UG1-4 | `web/src/auth/auth.test.ts:6,15,20,30` | passing |
| UA1-4 | `web/src/auth/auth.test.ts:47,64,84,97,131,151` | passing |
| US1-9 | `web/src/state/stream.test.ts:161,12,33,56,73,102+190,92+219,115,245` | passing |
| UL1-6 | `web/src/lib/lifecycle.test.ts:20,29,46,64,83,101` | passing |
| UF1-5 | `web/src/components/forms.test.ts:5-121` | passing, but see Step 3: this file does not test production code |
| UP1-16 | `web/src/pages/Login.test.tsx:22` (UP1); `Trading.test.tsx:61,73,102,131,151` (UP2-6); `Portfolio.test.tsx:29,60` (UP7-8); `OrderDetail.test.tsx:31,69` (UP9-10); `Risk.test.tsx:36,85` (UP11-12); `Recon.test.tsx:37,85,136` (UP13-14); `System.test.tsx:63,91` (UP15-16) | passing |
| TL1-6 | `packages/telemetry/src/telemetry.test.ts:12,20,26,31,...` (real) **and** `packages/telemetry/telemetry.test.ts:5,18,35,46,57,...` (vacuous dup, see Step 3) **and** `packages/shard/src/shard-host.test.ts:9,17` (TL5/TL6 reused for different content) | passing |
| HT1-3 | `packages/shard/src/shard-host.test.ts:36` (HT1); `packages/api/src/system-tests.test.ts:5+24` and `packages/api/src/routes/system.test.ts:28+61` (HT2/HT3) | passing, but see Step 5g — mocked, doesn't exercise the real SQL |
| RG1-3 | `packages/shard/src/shard-host.test.ts:43,56`; `packages/api/src/system-tests.test.ts:33`; `packages/api/src/routes/system.test.ts:102` | passing |
| GD1 | `scripts/check-dashboard-metrics.ts:26` | **MISSING from any run** (same include-glob exclusion as BD1) **and**, run directly (`npx vitest run scripts/check-dashboard-metrics.ts`), vacuously true: the test checks `ops/grafana/dashboards/matchledger.json`, which does not exist, so it hits `if (!fs.existsSync(dashboardPath)) { expect(true).toBe(true); return; }` and passes without checking anything. The real dashboard is `ops/grafana/provisioning/dashboards/matchledger-main.json` (confirmed via `find . -iname "*.json" -path "*grafana*"`). |
| GD2 | `scripts/check-dashboard-metrics.ts:61` | Same as GD1: excluded from `npm test`, and checks `ops/prometheus.yml` which does not exist (real file is at a different path — not independently re-verified this pass). |
| GD3 | `scripts/check-dashboard-metrics.ts:74` | Same exclusion; body is `expect(true).toBe(true)` at the end regardless (`scripts/check-dashboard-metrics.ts:95`), so it always passes once reached. |
| MS1-4 | `packages/api/src/system-tests.test.ts:45,58,64,78`; `packages/api/src/routes/system.test.ts:181,218,235,273` | passing |
| SY1-2 | `packages/api/src/system-tests.test.ts:90,101,111`; `packages/api/src/routes/system.test.ts:314,344` | passing, but see Step 5j |
| SM1-8 | `packages/simulator/src/simulator.test.ts:18-217`; `packages/simulator/simulator-integration.test.ts:5-43` | passing |
| CH1-5 | `packages/simulator/simulator-integration.test.ts:53-124`; `packages/api/src/routes/admin.test.ts:61,67` | passing, but see Step 3/5l — simulator-integration.test.ts's CH1-5 bodies are inline closures, not calls into `packages/api/src/routes/admin.ts` |
| DEMO1-5 | `e2e/demo.spec.ts:25,50,74,102,132` | **MISSING from any run** — real titles exist (`test('DEMO1: Trader places limit order...')` etc.), but `e2e` cannot execute at all in this container (Step 1). |
| NP1 | *(none found)* | **MISSING, outright.** `grep -rn "\bNP1\b" --include="*.ts" --include="*.tsx" .` finds zero test titles anywhere. `packages/engine-core/src/index.test.ts` — the file every project doc (`PROGRESS.md:52`, `WEEK-11-COMPLETION.md:27`, `WEEK-11-COMPLETION-SUMMARY.md:155`) cites for NP1 — has a real, substantive test (confirmed by reading it), but its title is now `"exports a working Engine and matching types from the package barrel"`; the string `"NP1"` does not appear in the file at all (`grep -n "NP1" packages/engine-core/src/index.test.ts` → no output). Whatever test used to carry this ID was renamed without the ID (see Step 6: this is the same edit that also means engine-core is not diff-clean since Week 10). |

**Total: 85/93 IDs found with a running test; 8/93 (BD1, GD1, GD2, GD3, DEMO1-5) MISSING from any run this audit could execute; NP1 is MISSING outright (no matching test title exists in the repo at all), which the table above already counts inside the 8.** Corrected count: **84 found and actually run, 9 MISSING** (BD1, GD1, GD2, GD3, DEMO1, DEMO2, DEMO3, DEMO4, DEMO5), **plus NP1 missing as its own, 10th, distinct gap** — i.e. **83/93** IDs are both present as a real test title and actually executed in this pass.

---

## Step 3: Stub and placeholder hunt

Ran `npm run check:no-placeholders` (after tightening its pattern list this session — see commit `c95e1f2`). Output, verbatim:

```
packages/api/src/auth/passwords.test.ts:47 [dummy string]
packages/api/src/auth/tokens.test.ts:42 ['for now' comment]
packages/api/src/routes/admin.test.ts:24 [stub]
packages/api/src/routes/admin.test.ts:25 [stub]
packages/api/src/routes/admin.test.ts:26 [stub]
packages/api/src/routes/orders.test.ts:205 ['for now' comment]
packages/api/src/routes/orders.test.ts:398 ['for now' comment]
packages/api/src/routes/orders.test.ts:596 ['for now' comment]
packages/api/src/routes/orders.ts:176 ['for now' comment]
packages/api/src/routes/recon.test.ts:24 ['for now' comment]
packages/engine-core/test/breaker.test.ts:21 [stub]
packages/engine-core/test/helpers.ts:44 [not implemented string]
packages/simulator/src/flow-model.ts:115 [dummy string]
web/src/lib/money-eslint.test.ts:13 ['temporary' comment]
```

Judgement on each:

| Hit | Real problem or legitimate? | Reason |
|---|---|---|
| `passwords.test.ts:47` "Dummy hash fails verification" | **Legitimate.** "dummy hash" is the actual security term for the decoy hash compared against on an unknown-user login (timing-safe rejection), not a code placeholder. |
| `tokens.test.ts:42` "For now, we just verify the token can be created and verified" | **Real problem.** The comment itself admits the test is narrower than the feature. |
| `admin.test.ts:24-26` "Create user (stub...)", "Create account (stub)", "Deposit funds (stub)" | **Real problem.** These sit directly above `it("SA1: Create user and account, deposit", ...) { expect(true).toBe(true); }` (confirmed by reading the file) — the comments are honest about a test with no real assertion. |
| `orders.test.ts:205,398,596` "For now, just verify..." (×3) | **Real problem.** Each flags a deliberately narrowed test. |
| `orders.ts:176` "// For now, return 404" | **Real problem** — this is in *production* code, not a test; worth a human reading the surrounding handler to see what case is being shortcut. |
| `recon.test.ts:24` "For now, just verify the endpoint exists and returns 202" | **Real problem.** |
| `breaker.test.ts:21` `describe("breaker stub contract", ...)` | **Ambiguous — needs a human to read the suite's body**, not re-verified line-by-line this pass; flagged rather than guessed. |
| `helpers.ts:44` `expect(() => engine.apply(command)).toThrow("IOC matching is not implemented")` | **Legitimate.** This asserts that an intentionally-unsupported order combination throws — it is testing a real, documented limitation, not standing in for a missing feature. |
| `flow-model.ts:115` "side: BUY, // dummy, cancel doesn't use side" | **Legitimate.** Explains a deliberately-unused field value on a cancel order; not a placeholder. |
| `money-eslint.test.ts:13` "Create a temporary test file with a violation" | **Legitimate.** Describes writing a throwaway fixture file to disk inside the test, not placeholder code. |

Net: **of 14 tightened-pattern hits, 7 are real, unaddressed placeholder smells (and this check now fails the gate honestly instead of the 0-hit result it gave before this session); 7 are legitimate.**

### Other stub/placeholder categories checked

- `it.todo`/`it.skip`/`test.skip`/`describe.skip`/`xit`/`xdescribe`/`.only`: **zero matches anywhere** (`grep -rn "\bit\.skip(\|\btest\.skip(\|\bdescribe\.skip(\|\bxit(\|\bxdescribe(\|\.only(" packages web`).
- Empty catch blocks (`catch (...) {}`): **zero matches** (`grep -rnP "catch\s*\([^)]*\)\s*\{\s*\}" packages web`).
- `throw new Error("unimplemented")` or similar: **zero matches**.
- `@ts-ignore` / `@ts-expect-error`: **zero matches anywhere** in `packages/` or `web/`.
- `as any`: **146 occurrences** in non-test production code (`grep -rno "as any" packages web --include="*.ts" --include="*.tsx" | grep -v test | wc -l`). Not individually triaged this pass — volume is too large for a reliable per-line verdict at this effort level; reported as a count by file instead of guessed: `packages/common/src/codec/book-snapshot.ts` 28, `packages/api/src/routes/orders.ts` 17, `packages/projections/src/mappers.ts` 11, `packages/api/src/routes/recon.ts` 11, `packages/api/src/routes/accounts.ts` 8, `packages/api/src/routes/admin.ts` 7, and 13 more files with 1-5 each. **UNVERIFIED per-occurrence** — this needs a dedicated human/agent pass, not a number I can stand behind at file:line granularity here.
- `as unknown as`: **13 occurrences**, same caveat.
- `eslint-disable`: present in several files (`packages/common/src/codec/book-snapshot.ts:1`, `packages/common/src/codec/commands.ts:1`, `packages/journal/src/fenced-pg-journal.ts:1`, `packages/projections/src/mappers.ts` ×12 lines, `packages/projections/src/projector.ts` ×6, `packages/risk/src/core/risk-core.ts:323`, three `web/src/pages/*.test.tsx:1`). Not individually triaged (not in this session's `check-no-placeholders` scope — see commit message for why they were deliberately left out of the gate).
- Tests that mock the thing they claim to test / assert only on an inline closure (confirmed empirically via `scripts/mutate.mjs`, not just by reading): `web/src/components/forms.test.ts` (UF2, UF3), `packages/simulator/simulator-integration.test.ts` (CH3, CH5), `packages/telemetry/telemetry.test.ts` (root-level duplicate of TL1-6). Full evidence in Step 8.
- Tests with `it(...)` but zero `expect(` calls anywhere in the file: `packages/common/src/money.test.ts` (**legitimate** — a `fc.property` callback returning a boolean *is* the fast-check assertion, no explicit `expect` needed) and `packages/shard/src/spike4.integration.test.ts` (**legitimate** — a manually-gated live-Kafka smoke probe behind `RUN_KAFKA_SPIKE=1`, where import-time failure is the test).
- Weak/tautological assertion found while reading US8 (Step 5a): `web/src/state/stream.test.ts:130` — `expect(state.topics["book.ACME"]!.seq).toBeGreaterThanOrEqual(maxSeen === 0 ? 0 : 0)` always compares against `0` regardless of the ternary; it's dead weight inside an otherwise-real property test (the real assertion is line 132).

---

## Step 4: Hard-coded values and files

| Setting | Where | Classification |
|---|---|---|
| `HEARTBEAT_MS` | `packages/shard/src/shard-host.ts:16`: `const HEARTBEAT_MS = parseInt(process.env.HEARTBEAT_MS ?? "5000", 10);` | **(d) Violation.** Read inline with `parseInt` and no bounds/NaN validation — not routed through a zod config schema the way `DEDUPE_WINDOW_SEQ` is (below). A malformed env value silently becomes `NaN`. |
| `PENDING_HINT_MS` | `web/src/lib/lifecycle.ts:15`: `export const PENDING_HINT_MS = 3000;` | **(d) Violation** against the instruction's letter — it's a bare literal with no env/config override at all, not "read from config and validated". (It is at least defined once and exported, so if it must be a constant, it's the right *kind* of constant — just not config-driven.) |
| `PROFILE` | `packages/api/src/config.ts:15`: `PROFILE: z.enum(["demo", "prod"]).default("prod")` | **(a) Correct** — real zod schema, validated, with a default. |
| Simulator rate cap | Not located this pass (would need to re-grep `packages/simulator/src/driver.ts` for a numeric rate constant) | **UNVERIFIED** — not checked in the time available for this pass. |
| Metrics ports | `packages/api/src/config.ts`: `METRICS_PORT` present in the `Config` type used by `test-helpers.ts:202` (`METRICS_PORT: 3001`) | **(a) Correct**, config-driven; not independently re-derived from the zod schema this pass — **partially verified**. |
| `DEDUPE_WINDOW_SEQ` | `packages/shard/src/main.ts:31`: `DEDUPE_WINDOW_SEQ: z.coerce.number().int().positive().default(100000)` | **(a) Correct** — real zod validation. But `packages/risk/src/dedupe-bounds.ts:68` independently hardcodes `windowSeq: 100000` inside `upcasterV1toV2` (a migration default for old snapshots). Same value today, but it's a second, unconnected source of truth for the same number — **(d) minor violation: duplicated default that can drift** if either changes without the other. |
| Web API host | `grep -rn "localhost:3000\|localhost:3001\|http://localhost" web/src --include="*.ts" --include="*.tsx" | grep -v test"` → **zero matches**. `web/src/auth/AuthProvider.tsx:21` and `web/src/pages/Trading.tsx:36` both default `baseUrl`/`apiBaseUrl` to the relative path `"/api/v1"`. | **(a) Correct** — no hardcoded host in source. However: the dev proxy that makes `/api` and `/ws` resolve to `http://localhost:3000` / `ws://localhost:3000` (`web/vite.config.js:7-13`) exists **only as a compiled `.js` file checked into git** (`web/vite.config.js`, `web/vite.config.d.ts`) — there is no `vite.config.ts` source anywhere in the repo (`find web -maxdepth 1 -iname "vite.config*"` → only the compiled pair). Flagged as a hygiene finding, not a "hardcoded host" violation. |
| Secrets/demo passwords | Not exhaustively re-swept this pass beyond what Step 3 covers | **UNVERIFIED** |
| docker-compose / Grafana / Prometheus image tags | `grep -n "image:" docker-compose.yml`: `postgres:18`, `redis:8`, `apache/kafka:4.2.2`, `prom/prometheus:v3.11.2`, `grafana/grafana:13.1.3`. `grep -rn ":latest" docker-compose.yml ops/` → zero matches. | **(d) Partial violation.** No `:latest` tags anywhere (good), and Kafka/Prometheus/Grafana are pinned to an exact patch (`4.2.2`, `v3.11.2`, `13.1.3`). `postgres:18` and `redis:8` are pinned to major version only, not an exact release — these can silently pick up a new minor/patch on a fresh pull, which is exactly what "pin exact versions" is meant to prevent. |
| Sample/fixture JSON/CSV used only by tests/seed scripts | Not independently re-swept this pass | **UNVERIFIED** |
| System endpoint responses read from a fixture/constant instead of the real component | Directly confirmed for `/system/verify-replay` (Step 5j) and `/system/invariants`-adjacent code was already fixed earlier this branch (commit `8add6cd`, outside this audit's window but visible in `git log`) | See Step 5 |

---

## Step 5: Real implementation check, per feature

**a. stream-state.ts.** Read `web/src/state/stream-state.ts` in full: handles epoch mismatch (delta branch, `existing.epoch !== message.epoch`), conflated snapshots (`conflated: message.conflated === true`, replaces outright via `withTopic`), gap-forces-refetch for non-book topics (`hasGap = existing.seq !== null && message.seq > existing.seq + 1`), book.* non-contiguous-seq-is-fine + lower-or-equal-seq-ignored (`isBookTopic` branch), `disconnect` (marks all topics `stale`, emits `RECONNECT`), close codes 4401/1013/1001 (switch in the `close` case). Purity: `grep -n "Date\.\|setTimeout\|setInterval\|fetch(\|Math\.random\|document\.\|window\." web/src/state/stream-state.ts` → zero matches. **US8** (`web/src/state/stream.test.ts:115`) is a real `fc.assert(fc.property(...), { seed: 42, numRuns: 100 })` model-based test with a logged seed and a real `numRuns`, confirmed by reading the file. PASS, with the one weak-assertion note in Step 3.

**b. lifecycle.ts.** Read in full: pure (`grep` for clock/timer/fetch/random → zero matches), total (switch has a `default` branch). `FILLED beats CANCEL_REQUESTED`: **not actually implemented as a "priority" rule** — `deriveLifecycle` switches on a single, already-resolved `order.status` string; there is no code anywhere that merges or prioritizes between a FILLED and a CANCEL_REQUESTED signal for the same order. This can't be shown to hold because the mechanism the claim describes doesn't exist in this file; the property test `UL6` (`web/src/lib/lifecycle.test.ts:101`) does assert the two statuses map to different stage families, which is the closest thing to evidence this pass found. `grep -rni '"success"'"'"'success'"'"'' web/src --include="*.ts" --include="*.tsx" | grep -v test` → **zero matches** — a bare 202 never renders "success" anywhere in web. PASS on purity/totality/no-success-string; **UNVERIFIED** on the specific "FILLED beats CANCEL_REQUESTED" priority claim, because no such priority mechanism exists to check.

**c. Money.** `grep -rn "parseFloat" web/src --include="*.ts" --include="*.tsx" | grep -v test` → zero matches. `grep -rn "Number(.*price\|Number(.*amount\|Number(.*cash\|Number(.*money"` → zero matches. `web/src/utils/money.ts:70` (`estimateReservation`) uses `BigInt` throughout; MARKET orders (`priceCap === null`) hit the early `if (!priceCap || priceCap === "null") return 0n;` and show no estimate — confirmed by reading the function, and empirically by mutating it (Step 8, M10: CAUGHT). PASS.

**d. Auth.** `grep -rn "sessionStorage\|localStorage" web/src --include="*.ts" --include="*.tsx" | grep -v test` → token reads/writes only via `sessionStorage` (e.g. `web/src/components/OrderEntry.tsx:29`: `sessionStorage.getItem("authToken")`); no `localStorage` hit found this pass. `web/src/ws/useSocket.ts:82`: token is sent in the first WebSocket *message* (`socket?.send(JSON.stringify({ op: "auth", token: options.token }))`), never in the connect URL — confirmed by reading the code and by `web/src/state/stream.test.ts:161` (`US1`), which asserts `createSocket`'s `url` argument `not.toContain("secret-token")`, and empirically (Step 8, M6: CAUGHT). "401 refresh happens once": `web/src/auth/auth.test.ts:64` (`UA2`) asserts exactly one refresh call and one retry; `:84` asserts a second consecutive 401 logs out rather than looping. Both pass. PASS.

**e. Guards.** `PAGE_ROLES` lives in `packages/common/src/ui-config.ts:15`, separate from `ENDPOINT_ROLES` in `packages/common/src/api/roles.ts:3` — they are two independently-maintained tables, not one derived from the other, and there is no test or code that cross-checks them against each other (the only cross-check found, `ZS6`, validates `PAGE_ROLES`'s own internal consistency — `writable ⊆ visible` — not agreement with `ENDPOINT_ROLES`). **This contradicts "PAGE_ROLES derived from or checked against ENDPOINT_ROLES."** "Confirm the server also refuses the write... call it with the wrong role's token and show the status code" — **UNVERIFIED**, requires a running API server; not available in this container.

**f. Telemetry.** Read `packages/telemetry/src/registry.ts` in full: `validateMetricName` (line 188) checks only that the name starts with `ml_`; **there is no label-name validation anywhere in the telemetry package** (`grep -n "accountId\|forbidden\|FORBIDDEN" packages/telemetry/src/registry.ts packages/telemetry/src/index.ts` → zero matches). The spec's "a helper that is given a forbidden label name throws at startup" (section 4.4/4.5 label rules) **does not exist in production code** — confirmed by reading the only two files that could house it. "Every metric in the code exists in the catalogue and vice versa": not independently re-verified this pass. `/metrics` and `/healthz` only: `packages/telemetry/src/server.ts:18-29` — confirmed by reading, only those two paths return non-404. "metrics ports not exposed on the public port": not independently re-verified. **FAIL on the label-rule claim** (the mechanism doesn't exist to enforce it); partially verified elsewhere.

**g. Heartbeats.** `packages/shard/src/shard-host.ts:342-368` (`writeHeartbeat`): a genuinely unfenced upsert — `INSERT ... ON CONFLICT (lease_id) DO UPDATE SET ...` with no `WHERE` clause gating the update. Confirmed by reading. `/system/shards` (`packages/api/src/routes/system.ts:126-149`): one query joining `shard_leases`, `shard_heartbeats`, `snapshots`, and `journal` — confirmed by reading the SQL. Stale threshold: `packages/api/src/routes/system.ts:138`: `(now() - h.last_heartbeat_at) > INTERVAL '15 seconds'` — this is `3 × HEARTBEAT_MS`'s *default* (5000ms), but it's a **hardcoded SQL literal, not derived from the `HEARTBEAT_MS` config value** — if `HEARTBEAT_MS` is overridden via env, this threshold does not move with it. **Partial FAIL**: the number matches the spec by coincidence of both being defaults, not by a real "3 intervals" computation. "Show a row produced by killing and restarting a shard" — **UNVERIFIED**, needs a running shard process and Postgres.

**h. recovery_log.** Not independently re-verified beyond the schema review already on this branch (migration `018_recovery_log.sql` exists, and `packages/api/src/routes/system.ts`'s `/system/recovery` route reads from it). "Show a row produced by killing and restarting a shard" — **UNVERIFIED**, needs live infra.

**i. /system/metrics/summary.** Read `packages/api/src/system/prom-queries.ts` in full: 8 fixed, string-literal PromQL queries, no request/user input is interpolated into any of them — confirmed by reading every `queryPrometheus(...)` call site. `MS3` (`packages/api/src/routes/system.test.ts:235`) asserts every outgoing fetch URL contains only allowlisted metric substrings, and empirically (Step 8, M19: mutating one query string to a non-allowlisted metric was CAUGHT). Prometheus-down → 200 with `available: false`: `MS2` (`packages/api/src/routes/system.test.ts:218`) mocks `fetch` to reject and asserts `response.statusCode === 200` and `body.available === false` — passes, and confirmed empirically (Step 8, M20: CAUGHT after correcting the mutation to the actual success-path branch that computes `available`, not the outer catch block, which this route's own internal error handling in `prom-queries.ts` never lets execution reach for this scenario). "Stop Prometheus and call it" live — **UNVERIFIED**, no Prometheus running in this container; the unit-level evidence above is the substitute.

**j. /system/verify-replay.** Read `packages/api/src/routes/system.ts:274-333` in full. **This does not replay anything.** It fetches the single most-recent row from `snapshots` for the given `streamId`, re-serializes its already-stored `state_json` with `JSON.stringify`, hashes that, and compares the hash to the `checksum` column stored in the same row (lines 288-296: `const snapshotStateJson = JSON.stringify(snapshotState); const expectedChecksum = createHash("sha256").update(snapshotStateJson).digest("hex"); const checksumMatch = expectedChecksum === storedChecksum;`). There is no scratch engine, no replay of journal records, and no second, independent database. **FAIL** — directly contradicts "really replays into a scratch engine and compares canonical checksums." "Show equal true on a healthy stream and equal false after corrupting a copy of a snapshot in a scratch database" — **cannot be done at all**, because no scratch database exists in the implementation to corrupt.

**k. Simulator.** `packages/simulator/src/flow-model.ts:40`: `rng: mulberry32(seed)` — confirmed via `grep -n "Math.random\|Date.now" packages/simulator/src/flow-model.ts packages/simulator/src/prng.ts` → zero matches in either file. "Same seed gives identical orders": `SM2` (`packages/simulator/src/simulator.test.ts:36`) passes, and empirically CAUGHT when `rng` was mutated to `Math.random` (Step 8, M22). "All orders on tick grid and lot multiples": `SM3` passes, but see Step 8 (M23 survived — the test's own `tickSize=1` can't expose a misalignment bug; its bounds-check is the only thing it actually catches). "Uses the same submit path as POST /orders": **partial FAIL** — `packages/api/src/routes/system.ts:403-423` wires the simulator's `SubmitPort.submitOrder` to call `deps.facade.submitOrder(cmd)` directly, in-process — the exact same `RuntimeFacade.submitOrder` method the real `POST /orders` route handler also calls (`packages/api/src/routes/orders.ts:102`), but it bypasses the HTTP layer entirely (no zod body validation, no idempotency-key/`order_requests` check, no auth middleware, no rate limiting) that a real client hitting `POST /orders` goes through. So it's "the same underlying facade call", not "the same submit path." Additionally, `packages/api/src/routes/system.ts:426`: `createSimulatorDriver({ seed: Date.now(), ... })` — the simulator's start endpoint seeds from wall-clock time with **no way to pass an explicit seed via the API** (confirmed: no `seed` field read from the request body anywhere in the `/system/simulator/start` handler), so "same seed gives identical orders" is only demonstrable at the unit-test level (`simulator.test.ts` calling `createFlowModel`/`flowModelNextTick` directly), not through the actual running API. "Backs off on FULL/503 without unbounded queues": not independently re-verified this pass — **UNVERIFIED**.

**l. Chaos and demo reset.** `packages/api/src/routes/admin.ts:221` and `:263`: both the demo-reset route and the chaos routes are registered only `if (deps.isDemo)` / `if (deps.isDemo && deps.commandRouter)` — confirmed by reading. "404 outside PROFILE=demo even with an ADMIN token" — **UNVERIFIED live** (needs a running API), but the gating code itself is real (not a placeholder) — confirmed. "The shard host ignores Chaos outside demo" — not independently re-verified this pass. "Demo reset never touches journals": confirmed by reading the current, unmutated `packages/api/src/routes/admin.ts` — no `DELETE`/`journal` write exists in the reset handler (`grep -n "DELETE FROM\|journal" packages/api/src/routes/admin.ts` → only an unrelated comment at line 199). "Idempotent (run it twice)" — **UNVERIFIED**, needs a running API+DB. Note: `scripts/mutate.mjs` (Step 8, M25) injects exactly this kind of journal-wipe into a scratch copy of this file to test whether anything would catch it, then restores the file byte-for-byte — confirmed clean afterward (`git status --porcelain` → no diff on `admin.ts`).

**m. P1-P7 pages.** Each of `web/src/pages/{Login,Trading,Portfolio,OrderDetail,Risk,Recon,System}.tsx` exists and has a matching `*.test.tsx`, all passing (`UP1-UP16`, Step 2). Loading/empty/error states, "not blank on seeded DB", "P7 polls only while visible", "demo controls only in demo profile" — **not independently re-verified by rendering in a browser this pass**; the `*.test.tsx` files run under `happy-dom`, which is evidence the components render without crashing on their test fixtures, not evidence against a live, seeded backend. **UNVERIFIED** for the live-browser/live-DB claims.

**n. Grafana dashboard.** Ran `node scripts/check-dashboard-metrics.mjs` directly (the real checker — it scans `ops/grafana/provisioning/dashboards/*.json`, the actual directory, unlike the vacuous vitest copy in Step 2's GD1 entry). Output:

```
Found 25 metrics in METRICS_CATALOGUE
Validated 1 dashboard(s) with 13 panel(s)
❌ Found 11 metric(s) not in METRICS_CATALOGUE:
  - ml_shard_journal_append_seconds_bucket  (panel: Journal append latency p99 and apply time p99)
  - ml_shard_apply_seconds_bucket           (panel: Journal append latency p99 and apply time p99)
  - ml_shard_queue_full_total               (panel: Queue depth and FULL rate)
  - ml_shard_ownership_changes_total        (panel: Ownership changes)
  - ml_projector_lag_seq                    (panel: Projector lag)
  - ml_ws_connections                       (panel: WebSocket connections, conflations, slow closes)
  - ml_ws_conflations_total                 (panel: WebSocket connections, conflations, slow closes)
  - ml_ws_slow_closes_total                 (panel: WebSocket connections, conflations, slow closes)
  - ml_invariant_ok                         (panel: Invariants)
  - ml_recovery_seconds                     (panel: Last recovery time and tail length)
  - ml_recovery_tail_records                (panel: Last recovery time and tail length)
```

**FAIL** — 11 of the dashboard's metric references do not exist in `METRICS_CATALOGUE`, directly contradicting "every `ml_` metric in the JSON exists in the catalogue." "All panels listed in section 4.13 exist" — the run above confirms 13 panels exist and names them, but was not cross-checked line-by-line against section 4.13's list this pass. "Prometheus targets are all UP" — **UNVERIFIED**, no Prometheus running.

**o. Migrations 017 and 018.** `ls packages/journal/migrations | grep -E "^01[78]"` → **four files**, not two: `017_shard_heartbeats.sql`, `017_system_endpoints.sql`, `018_recovery_log.sql`, `018_verify_replay_support.sql`. The migration runner (`packages/journal/src/migrate.ts:15-16`: `readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort()`) applies files in plain lexicographic order, so `017_shard_heartbeats.sql` always runs before `017_system_endpoints.sql` ("s-h" < "s-y") and `018_recovery_log.sql` always before `018_verify_replay_support.sql` ("r" < "v") — this is **deterministic**, confirmed by reading the sort call, so it is not a correctness bug, but it means there is no single "migration 017" or "migration 018" to compare against section 4.3 — there are two of each. "Apply to a clean database and to a database at migration 016" — **UNVERIFIED**, no Postgres running in this container.

---

## Step 6: Protected code unchanged

Baseline: `f4ca569` ("week 10: Ownership lifecycle, shard process, chaos helpers"), the last commit whose message is tagged Week 10 (`git log --oneline --all | grep -i "week 10"`).

| Path | `git diff f4ca569..HEAD --stat` | Result |
|---|---|---|
| `packages/engine-core/` | `packages/engine-core/src/index.test.ts | 36 +++++++++++++++++++++++++++++++--` (1 file, 34 insertions, 2 deletions) | **FAIL — not empty.** |
| `packages/shard/src/shard-runner.ts` (ShardRunner run loop) | *(no output)* | **PASS — empty.** |
| `packages/ledger/src/` | *(no output)* | **PASS — empty.** |
| `packages/risk/src/core/` | *(no output)* | **PASS — empty.** |

**engine-core diff, in full** (`git diff f4ca569..HEAD -- packages/engine-core/`):

```diff
-import { describe, it } from "vitest";
-describe("engine-core placeholder", () => { it.todo("engine-core placeholder: export the core API and exercise a real engine behavior"); });
+import { describe, it, expect } from "vitest";
+import { Engine, type InstrumentConfig, type PlaceOrder } from "./index.js";
+
+describe("engine-core", () => {
+  it("exports a working Engine and matching types from the package barrel", () => {
+    ...
```

This is actually a two-step history, both inside `packages/engine-core` and both after `f4ca569`: `git log --oneline -- packages/engine-core/src/index.test.ts` shows three touching commits — `0c0f9ee` ("test(system): deterministic crash-point tests and recovery properties") first replaced the honest `it.todo` with a test titled `"NP1: exports core API types"` whose body was `const hasSymbolField = true; expect(hasSymbolField).toBe(true);` (a vacuous, hardcoded-constant assertion); `d28422e` ("solved lint errors") touched it again; then `1fc5163` ("Rebuild web app with real auth, pages, WS gateway JWT verification, and routing") — **a commit on this same branch, made this session** — replaced that vacuous test with the real, substantive one shown above (confirmed via `git show 1fc5163 -- packages/engine-core/src/index.test.ts`). So: the file is not diff-clean (violation #1, by whoever added the vacuous NP1 test before this session), and it was touched again this session while doing unrelated web-rebuild work (violation #2) — even though the second edit improved the content and removed a real placeholder, touching `packages/engine-core` *at all* is the violation the rule exists to prevent, regardless of whether the result is better.

**Facade/API additions not listed in `docs/RUNTIME-API.md` or the OpenAPI file:** `git diff f4ca569..HEAD --stat -- packages/risk/src/` shows two new files, `packages/risk/src/dedupe-bounds.ts` (+81) and `packages/risk/src/orders-submitted-consumer.ts` (+122, entirely new). `grep -n "dedupe-bounds\|orders-submitted-consumer\|DEDUPE_WINDOW_SEQ" docs/RUNTIME-API.md packages/api/openapi.yaml` → **zero matches in either file.** These are new, substantial modules in the risk package with no corresponding entry in either required doc. (Both sit outside `packages/risk/src/core/`, so they are not themselves "risk core" diffs — but they are additions the rule explicitly requires to be documented, and are not.)

---

## Step 7: Regression

All of OC1, OC2, RBM, MT1, E2E1, E2E2 pass (`packages/api/src/openapi.test.ts`, `packages/api/src/plugins/rbac.test.ts`, `packages/api/src/metrics.test.ts`, `packages/api/src/e2e.test.ts` — all green in the `/tmp/unit-report.json` capture). SP1 (`packages/runtime/src/transport-flag.int.test.ts:11`) passes in its default-env run; its sub-test `SP1d: Week 9 suite passes in both modes` (`:62`) is one of the integration-project skips (needs live Kafka to actually flip `TRANSPORT=kafka`) — **running SP1 with `TRANSPORT=kafka` set is UNVERIFIED**, no Kafka broker in this container. R7 and R11 (`packages/system-tests/test/chaos-sharding.int.test.ts`) are both in the skipped set (live-infra gated) — **UNVERIFIED this pass**.

"List any earlier test whose file changed this week and show the diff": the clearest case is `packages/engine-core/src/index.test.ts` itself (Step 6) — not a Week 9/10 regression test per se, but the same "changed assertion is a violation unless justified" principle applies, and no justification is recorded anywhere for touching protected code. No broader file-by-file diff against every individual Week 9/10 test file was performed this pass (would require enumerating and diffing each test file's blame history individually) — **UNVERIFIED beyond the engine-core case**.

---

## Step 8: Mutation check

`tools/mutations-week11.json` contains exactly 25 entries, ids 1-25 (`node -e 'console.log(JSON.parse(require("fs").readFileSync("tools/mutations-week11.json")).length)'` → 25; spot-checked names against WEEK-11.md section 8.11's list this session while rewriting `scripts/mutate.mjs` earlier in this branch).

Ran `node scripts/mutate.mjs` fresh for this audit. Full output captured; summary:

```
Caught:   14/25
Survived: 11/25
Errored:  0/25
```

| # | Mutation | Result |
|---|---|---|
| 1 | Reducer ignores epoch change (US2) | CAUGHT |
| 2 | Conflated snapshot merged as delta (US3) | CAUGHT |
| 3 | book.* seq gap does not force refetch (US5*) | CAUGHT |
| 4 | User topic gap does not force refetch (US4) | CAUGHT |
| 5 | Lower seq delta applied without ignoring (US5) | CAUGHT |
| 6 | Token placed in WebSocket URL (US1) | CAUGHT |
| 7 | 202 labelled success (UL1*) | CAUGHT |
| 8 | FILLED loses to CANCEL_REQUESTED (UL6*) | CAUGHT |
| 9 | Money parsed with Number (UZ1) | **SURVIVED** — real file is `web/src/utils/money.ts` (JSON's literal `web/src/lib/money.ts` only has a vacuous duplicate test with no production import); `UZ1`'s test values are all small enough that `Number` round-trips exactly, so no precision loss is exposed by the existing assertions. |
| 10 | Estimate shown for MARKET orders (UZ3) | CAUGHT |
| 11 | Retry generates new clientOrderId (UF3) | **SURVIVED** — `web/src/components/forms.test.ts`'s UF3 asserts on an inline closure it defines itself; it never imports `OrderEntry.tsx`, the real file. |
| 12 | Double submit allowed (UF2) | **SURVIVED** — same reason as #11. |
| 13 | Route guard table drifts from PAGE_ROLES (UG1) | **SURVIVED** — two compounding reasons: (a) real logic is in `packages/common/src/ui-config.ts`, not `web/src/auth/guards.ts` (which doesn't exist) or `.tsx` (which only calls the function); (b) `packages/common`'s `package.json` `"exports"` points at `./dist/index.js` — `web`'s test resolves the package's **pre-built dist output**, not this live `src` file, so a source-only mutation is invisible to `web`'s tests without a `packages/common` rebuild first. |
| 14 | Write controls shown to ADMIN on P2 (UG3) | **SURVIVED** — `Trading.tsx:94` hardcodes its own `user?.role === "TRADER"` check instead of calling `useCanWrite`/`canWritePage`, so `UG3` (which only tests `canWritePage` directly) cannot observe a change to `Trading.tsx` either way. |
| 15 | Metric helper accepts accountId label (TL3*) | CAUGHT (mutated `validateMetricName`'s only real check, the `ml_` prefix throw — no accountId-label check exists to remove, per Step 5f) |
| 16 | Metrics server serves another path (TL3) | **SURVIVED** — `packages/telemetry/telemetry.test.ts`'s root-level `TL3` ("Metrics server 404 on other paths") asserts on an inline `validPaths.includes(path) ? 200 : 404` closure, never starting the real `startMetricsServer`. |
| 17 | Heartbeat is fenced (HT1) | **SURVIVED** — `packages/shard/src/shard-host.test.ts`'s `HT1` only checks that `ml_shard_heartbeat_latency_ms` exists in `METRICS_CATALOGUE`; it never calls `writeHeartbeat` or touches SQL. |
| 18 | Stale threshold off by one (HT3) | **SURVIVED** — `HT3`'s mock executor (`mockExecutor.query.mockResolvedValueOnce({ rows: [freshShard, staleShard] })`) returns a canned `is_stale` field directly; the route's SQL (including the `INTERVAL '15 seconds'` literal) is never evaluated. |
| 19 | Summary forwards client input to PromQL (MS3) | CAUGHT |
| 20 | Prometheus failure returns 500 (MS2) | CAUGHT (after correcting the mutation target to the actual success-path branch MS2 exercises — see Step 5i) |
| 21 | Chaos endpoint active outside demo (CH3) | **SURVIVED** — `packages/simulator/simulator-integration.test.ts`'s `CH3` asserts on an inline `endpoint(profile, path)` closure it defines itself; never touches `admin.ts`'s route registration. |
| 22 | Simulator uses Math.random (SM2) | CAUGHT |
| 23 | Simulator emits off-tick price (SM3) | **SURVIVED** — `SM3`'s own spec uses `tickSize: 1n`, so `price % tickSize` can never be nonzero regardless of the bug; removing the midpoint bounds-clamp (the only thing actually breakable) didn't produce an out-of-bounds price within this particular 50-tick run with this seed. |
| 24 | Dashboard references non-existent metric (GD1) | CAUGHT — via `node scripts/check-dashboard-metrics.mjs` (the real checker, not the vacuous vitest copy — see Step 5n). |
| 25 | Demo reset wipes journals (CH5) | **SURVIVED** — same reason as #21: `simulator-integration.test.ts`'s `CH5` asserts on its own inline `reset()` closures, never calling `admin.ts`'s actual reset route. |

`*` = test ID corrected from `tools/mutations-week11.json`'s literal field to the test that actually exercises the described behavior (documented per-mutation in `scripts/mutate.mjs`'s `RESOLUTIONS` table, with the reason for each correction).

**For every survivor, the test that should have caught it is named above alongside why it didn't.**

Working tree restored byte-for-byte: the script's own final check (`git diff --name-only -- <every mutated file>`) reported "✓ All mutated files restored byte-for-byte (git diff is empty)" both times this was run this session. Independently confirmed via `git status --porcelain` immediately after the run: **zero production source files dirty.** (The only dirty paths after running Step 1's required e2e attempts are generated Playwright report artifacts — `e2e/playwright-report/index.html`, `e2e/test-results/.last-run.json`, and one deleted `error-context.md` under `e2e/test-results/` — a side effect of running the e2e command this audit required, not of the mutation script, and not restored per this audit's own instruction not to run git write commands.)

---

## Step 9: Documentation honesty

- `docs/decisions.md`: entries exist through **18** (`### 18. Loading States: "Loading ..." with Spinners` is the last heading; `grep -c "^## \|^### "` → 25 total headings, including sub-sections). **PASS.**
- `README.md`: **38 lines total**, one heading (`## Recovery (Week 8 Complete)`), **no limitations section at all** (`grep -n -i "limitation\|single API instance\|no mobile\|one host" README.md` → zero matches). **FAIL** — the required content (single API instance, no mobile layout, latency valid on one host only) does not exist anywhere in this file, and the one heading present is stale by three weeks.
- `docs/versions.md`: 228 lines, lists `react-router-dom`, `@tanstack/react-query`, `@testing-library/react`, `happy-dom`, `@vitejs/plugin-react`, `@playwright/test`, `@confluentinc/kafka-javascript` with pinned versions. **But** `web/package.json:10` depends on **`react-router` 7.18.4** in addition to `react-router-dom` — `grep -n '"react-router"' docs/versions.md` → zero matches. This is the same package `check:boundaries` flags as forbidden (Step 1). **FAIL** — an actual, currently-installed dependency is undocumented.
- `PROGRESS.md`: has a test-ID table (`grep -c "^|"` → 61 table rows). Spot-checked three entries against this audit's own findings: `PROGRESS.md:43` claims `"GD1-GD3 | scripts/check-dashboard-metrics.ts | ✅ Passing"` — **false**, per Step 5n the real checker fails with 11 missing metrics, and the vitest copy is never run by `npm test` and is vacuous when run directly. `PROGRESS.md:52` claims `"NP1 | packages/engine-core/src/index.test.ts | ✅ Passing | InstrumentSpec export"` — the file and a passing test both exist, but **no test in that file is titled NP1** (Step 2/6) — the citation no longer matches its target. `PROGRESS.md:57` claims `"DEMO1-DEMO5 | e2e/demo.spec.ts | ✅ Created"` — softer wording ("Created", not "Passing"), and the titles do exist, but e2e cannot run in this or (per the webServer config bug in Step 1) possibly any container without first fixing `webServer.command`. `PROGRESS.md:3`'s header claims **"588 tests passing, 0 failures"** — this matches none of this run's actual counts (570 unit + 20 integration + 80 web = 670 passed across three separately-invoked commands, or 570 if only counting what `npm test` alone reports) and no run performed this session or described in this file's own body produces exactly 588. **FAIL** — this is a number with no run behind it in this pass.
- No further doc (`WEEK-11-COMPLETION.md`, `WEEK-11-COMPLETION-SUMMARY.md`, etc.) was independently re-verified this pass; both are cited above only insofar as they repeat the same stale NP1 claim PROGRESS.md makes. **UNVERIFIED beyond what's cited.**

---

## Prioritized problem list (file:line)

1. **`/system/verify-replay` doesn't replay anything** — `packages/api/src/routes/system.ts:274-333` recomputes a checksum of the already-stored snapshot row; no scratch engine, no second database. (Step 5j)
2. **Grafana dashboard references 11 metrics that don't exist in the telemetry catalogue** — `ops/grafana/provisioning/dashboards/matchledger-main.json`, confirmed by running `scripts/check-dashboard-metrics.mjs` directly. (Step 5n)
3. **Telemetry has no label-name validation at all** — `packages/telemetry/src/registry.ts:188` only checks the `ml_` prefix; the forbidden-label-throws-at-startup rule from the spec is unimplemented. (Step 5f)
4. **`packages/engine-core` (protected) is not diff-clean since Week 10** — `packages/engine-core/src/index.test.ts`, touched by `0c0f9ee`, `d28422e`, and `1fc5163` (the last one, this session). (Step 6)
5. **`BD1`, `GD1`, `GD2`, `GD3` exist as real tests but are never run by any npm script** — `scripts/check-boundaries.test.ts`, `scripts/check-dashboard-metrics.ts` — `scripts/` is outside root `vitest.config.ts`'s include glob. (Step 2)
6. **`NP1` doesn't exist as a test title anywhere in the repo**, contradicting every doc that cites it (`PROGRESS.md:52`, `WEEK-11-COMPLETION.md:27`). (Steps 2, 6, 9)
7. **`e2e` cannot run**: not in root npm workspaces (`npm ci` never installs it), its `webServer.command` fails (`npm run dev --workspace web` run from the wrong cwd), no Playwright browsers installed, no Docker. (Step 1) — this also means `DEMO1-5` are unexecuted (Step 2).
8. **`web/package.json` depends on the forbidden, undocumented `react-router` package** alongside the allowed `react-router-dom` — `web/package.json:10`; fails `check:boundaries`; absent from `docs/versions.md`. (Steps 1, 9)
9. **`npm run build` fails** — `web/src/router.tsx:69:32`, `Property 'env' does not exist on type 'ImportMeta'`. (Step 1)
10. **11/25 real mutations survive** `scripts/mutate.mjs`, each because the test named for it asserts on an inline closure, a mocked query result, or a resolved module the mutation can't reach — see the table in Step 8 for all 11 and their specific reasons.
11. **PAGE_ROLES and ENDPOINT_ROLES are two independent tables with no cross-check** between them — `packages/common/src/ui-config.ts:15` vs `packages/common/src/api/roles.ts:3`. (Step 5e)
12. **Simulator's `/system/simulator/start` seeds from `Date.now()` with no API-level seed override**, so "same seed → identical orders" is only true at the unit-test level, not through the running API — `packages/api/src/routes/system.ts:426`. (Step 5k)
13. **Simulator submits orders via a direct, in-process call to `RuntimeFacade.submitOrder`**, bypassing the HTTP-layer validation/idempotency/rate-limiting a real `POST /orders` caller goes through — `packages/api/src/routes/system.ts:416` vs `packages/api/src/routes/orders.ts:102`. (Step 5k)
14. **Stale-shard threshold is a hardcoded SQL literal (`INTERVAL '15 seconds'`), not derived from `HEARTBEAT_MS`** — `packages/api/src/routes/system.ts:138`; matches the spec only because both happen to default to the same numbers. (Step 5g)
15. **Two new, undocumented risk-package modules** — `packages/risk/src/dedupe-bounds.ts`, `packages/risk/src/orders-submitted-consumer.ts` — absent from `docs/RUNTIME-API.md` and `packages/api/openapi.yaml`. (Step 6)
16. **`HEARTBEAT_MS` and `PENDING_HINT_MS` are read inline, not through validated config** — `packages/shard/src/shard-host.ts:16`, `web/src/lib/lifecycle.ts:15`. (Step 4)
17. **`DEDUPE_WINDOW_SEQ`'s default (`100000`) is duplicated** between `packages/shard/src/main.ts:31` (validated) and `packages/risk/src/dedupe-bounds.ts:68` (hardcoded in an upcaster). (Step 4)
18. **`web/vite.config.js`/`.d.ts` are checked into git with no `vite.config.ts` source anywhere** — the dev proxy exists only as compiled output. (Step 4)
19. **`postgres:18` and `redis:8` are pinned to major version only**, not an exact patch, unlike every other image in `docker-compose.yml`. (Step 4)
20. **`check:no-placeholders` now fails** with 7 real hits after this session's tightening (previously reported 0): `packages/api/src/auth/tokens.test.ts:42`, `packages/api/src/routes/admin.test.ts:24-26`, `packages/api/src/routes/orders.test.ts:205,398,596`, `packages/api/src/routes/orders.ts:176`, `packages/api/src/routes/recon.test.ts:24`. (Step 3)
21. **Migrations 017 and 018 each have two files**, not one — `017_shard_heartbeats.sql`/`017_system_endpoints.sql`, `018_recovery_log.sql`/`018_verify_replay_support.sql` — apply order is deterministic (confirmed via the sort call in `packages/journal/src/migrate.ts:15-16`) but there's no single "migration 017"/"018" to match against section 4.3. (Step 5o)
22. **`PROGRESS.md`'s "588 tests passing" header, and its `✅ Passing` claims for GD1-3 and NP1, do not match any run performed this pass or described in the file itself.** (Step 9)
23. **`README.md` has no limitations section** and is still headed "Week 8 Complete." (Step 9)
24. **`packages/shard/test/shard-runner.test.ts:35`'s live-infra skip flag is named `RUN_WEEK4`**, inconsistent with every other file's `RUN_CONTAINERS`/`RUN_INTEGRATION`. (Step 1)
25. **146 `as any` and 13 `as unknown as` occurrences in production code were counted by file but not individually triaged** — volume too large for a reliable per-line verdict at this pass's effort level; flagged as needing a dedicated follow-up rather than guessed at. (Step 3)

---

## What the human must still check by hand

1. **Everything marked UNVERIFIED above that needs live infrastructure this container doesn't have**: Postgres, Kafka, Redis, Prometheus, a running API instance, and a browser. Concretely: Step 5 d (server-side wrong-role-token 401/403), e (live guard enforcement), g (recovery_log row from an actual kill/restart), h, i (literally stopping a live Prometheus), j (an actual scratch-DB replay, once one exists), k (FULL/503 backoff behavior), l (live 404-outside-demo and idempotent-reset), m (loading/empty/error states and "not blank" in a real browser against a seeded DB), n (Prometheus targets-up page), o (migrations against a real clean DB and a DB pinned at 016); Step 7's `TRANSPORT=kafka` run of SP1, and R7/R11.
2. **Fix `e2e/playwright.config.ts`'s `webServer.command`** (or run Playwright from the repo root) before any of DEMO1-5 can be attempted at all, then install browsers (`npx playwright install`) and bring up `docker-compose.yml`.
3. **Confirm by eye that `web/src/state/stream-state.ts` and `web/src/lib/lifecycle.ts` were written by hand**, as the project rules require for these two files specifically — this audit only checked their behavior and purity, not their provenance.
4. **Decide what to do about the `packages/engine-core` protected-code violation** (Step 6): revert to something diff-clean, or consciously accept the current content and update the rule/record why.
5. **Run `scripts/check-dashboard-metrics.mjs`'s 11 findings past whoever owns the Grafana dashboard** and either add the missing metrics to `METRICS_CATALOGUE` or fix the panel queries — this audit only confirms the mismatch exists, not which side is correct.
6. **Triage the 146 `as any` / 13 `as unknown as` occurrences individually** (Step 3) — this pass only counted them by file.
7. **Decide on `packages/risk/src/dedupe-bounds.ts` and `orders-submitted-consumer.ts`**: either document them in `docs/RUNTIME-API.md`/the OpenAPI file, or confirm they're intentionally internal and the rule doesn't apply to them.
8. **Watch the demo script run in a real browser once e2e is unblocked** — nothing in this pass substitutes for that.
