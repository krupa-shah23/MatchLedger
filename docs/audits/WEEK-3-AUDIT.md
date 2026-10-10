# Week 3 audit (abbreviated, read-only)

## 1. Verdict
**Week 3 definition of done: NOT MET.** IOC matching is an unimplemented stub, so the Week 3 core is incomplete.
- `packages/engine-core/src/matching/engine.ts:131-133`: `if (command.timeInForce === "IOC") { // TODO(week3) ... throw new Error("IOC matching is not implemented"); }`.
- Failing Week 3 tests: U8, U9, U22, U23, U24, U25 (`test/ioc.test.ts`) and D1 (`test/properties.test.ts`, "wired to the hand-written reference matcher").
- Not performed (UNVERIFIED because there is nothing to mutate): mutation checks M1-M9, purity proof in a worktree, 5x stability runs, `npm run bench` run, CI status.

## 2. Gate results (main tree, working copy)
| command | result |
|---|---|
| `npm run build` | no errors |
| `npm run lint` | no errors |
| `npm run check:boundaries` | "Dependency boundaries verified for all workspaces." |
| `npx vitest run` (JSON reporter) | total 107, passed 82, failed 21, skipped 4, todo 0 |
Failures by area: engine-core 7 (6 IOC + D1), risk 4, shard 10 (all Week 4 stubs: C2, C2b, C6, RK1, SH1-SH13, SP1). `npm ci` NOT RUN (would alter node_modules).
Wait-state note: the Week 4 failures are deliberate stubs ("record STUB verification handoff"), so `npm test` is red on main.

## 3. Engine purity
Lint passes on engine-core (rules scope `packages/engine-core/src/**`). Grep/worktree purity proof and `git diff` of eslint.config.js: NOT RUN. engine-core `dependencies` previously `{}`; boundary script passes.

## 4. Spec conformance
`docs/WEEK-3.md` and `docs/WEEK-2.md` DO NOT EXIST in the repo (only `docs/week2-plan.md`), so the checklist cannot be checked against its source. Items below are judged from code and test files.
| item | status | evidence |
|---|---|---|
| T1 types (`timeInForce`, `USER_REQUEST`) | PASS | engine.ts:176 `reason: "USER_REQUEST"`; `timeInForce` used in event input (engine.ts:206) |
| T2 IOC semantics | FAIL | engine.ts:131-133 throws |
| T3 id reuse only while resting | UNVERIFIED | |
| T4 `parseQuantity` | PARTIAL | `common/src/quantity.ts` (35 lines) + `common/test/quantity.test.ts` 9 tests pass; edge cases Q4/Q6 content not read |
| T5 reference matcher | PARTIAL | `test/helpers/reference-matcher.ts` is 24 lines, D1 fails |
| T6 generators / T7 event analysis | PARTIAL | files exist (`arbitraries.ts` 69, `event-analysis.ts` 80); content not read |
| T8 numRuns | UNVERIFIED | |
| T9 invariants after every command | UNVERIFIED | `assert-invariants.ts` exists (7 lines) |

## 5. Test inventory (from JSON results)
- `test/ioc.test.ts`: 18 tests, 6 FAIL (U8, U9, U22, U23, U24, U25), 12 pass (not individually mapped; some may pass vacuously: UNVERIFIED).
- `test/examples.test.ts`: 3 tests pass (EX1-EX3, exact-event depth not read).
- `test/properties.test.ts`: 8 tests, 1 FAIL (D1); 7 pass.
- `quantity.test.ts` 9 pass. Week 2 regression (`src/**/*.test.ts`: engine 16, orderBook 3, sortedPrices 2, referenceModel 4) all pass.
- U10, U12a/b, U26-U34, Q1-Q8, P12-P14, B1-B7 mapping: UNVERIFIED (not read). Missing IDs not enumerated.

## 6. Mutation table
NOT RUN. IOC is unimplemented; every IOC mutation would be meaningless until the stub is replaced.

## 7. Benchmarks and docs
- `packages/benchmarks/src/book.bench.ts` exists with B1, B2, B3... (50, 55, 60); `npm run bench` script exists; execution NOT RUN. `book.bench.ts` is modified and uncommitted.
- Untracked artifact dirs present: `packages/benchmarks/packages/`, `packages/common/dist-test/`, `packages/risk/dist-test/`, `packages/shard/dist-test/` (RISK: stray build output).
- docs/experiments.md E3 baseline table, nine Week 3 decisions, BLUEPRINT ID tables, tinybench in versions.md: NOT CHECKED.

## 8. Stability and CI
Stability 5x: NOT RUN. CI file is modified but uncommitted; status UNVERIFIED. Main tree has many uncommitted/untracked files (including engine `orderBook.ts`, which is untracked), so HEAD does not equal the working tree.

## 9. Findings
1. BLOCKER: IOC unimplemented, engine.ts:131-133. Fix: implement tail-only TIF branch (match loop shared, cancel remainder with `IOC_REMAINDER`, never rest).
2. BLOCKER: D1 fails, `test/properties.test.ts`; reference matcher is a 24-line stub. Fix: finish the independent plain-array reference with IOC.
3. SHOULD FIX: `docs/WEEK-3.md` and `docs/WEEK-2.md` missing, so no checklist source. Fix: add them or point the audit at `docs/week2-plan.md`.
4. SHOULD FIX: working tree diverges from HEAD (engine book files untracked, CI modified); a clean checkout would not build the same. Fix: commit.
5. SHOULD FIX: `npm test` is red on main from deliberate Week 4 stubs. Fix: mark stubs `it.todo` or gate by env var until implemented.
6. NICE: stray `dist-test` and `packages/benchmarks/packages` directories. Fix: delete and gitignore.

## 10. Human-only items
Explain the IOC branch and reference matcher aloud (once implemented); whiteboard Example 4; re-run `npm run bench` on a quiet laptop before quoting numbers.

Git check: only this report file was created by the audit; no worktree was created.
