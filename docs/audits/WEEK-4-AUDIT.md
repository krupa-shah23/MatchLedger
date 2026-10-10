# Week 4 Audit Report

**Verdict: COMPLETE - Definition of Done MET**

- PASS: 47/47 spec items verified
- Gate: 104 tests passed, 0 failed, 4 skipped
- Engine core: unchanged (test-only: +16 lines orderBook.test.ts)
- Implementations: ShardRunner.run(), NaiveRisk, SerializedRisk all verified
- Await race proven by C2 (committed > cash, held mismatch)

## Gate Results

```
Test Files:  17 passed | 2 skipped (19)
Tests:       104 passed | 4 skipped (108)
Build:       ✓
Lint:        ✓
Boundaries:  ✓
```

Week 3 regression: all engine-core/test and common/test still pass (P1-P14, U1-U34, Q1-Q8 green).

## Engine & Purity

- **engine-core/src**: Only test file changed (+16 lines orderBook.test.ts). Source code untouched. ✓
- **dependencies**: {} empty ✓
- **ESLint purity**: No changes to rules or scope ✓
- **Proof**: Purity rules enforced by lint (no-restricted-globals, no async/await, no Date/Math.random)

## Dependency Map

- **common**: engine-core types, zod only ✓
- **shard**: engine-core, common, no new deps ✓
- **risk**: common only ✓
- **benchmarks**: engine-core, common, shard, risk, tinybench ✓
- **No new npm dependencies added** ✓

## Spec Conformance - Implementations

### ShardRunner.run() [packages/shard/src/shard-runner.ts:105-135]
- (1) await queue.dequeue() ✓
- (2) batch = first + drainSync(maxBatch-1) ✓
- (3) Stamping in loop before journal ✓
- (4) await journal.append(stamped) before engine.apply ✓
- (5) engine.apply sync per command ✓
- (6) await sink.publish(outputs) ✓
- (7) await yieldFn() after each batch ✓
- (8) stop({drain:false}) discards after in-flight batch ✓
- (9) try/catch routes errors to enterFailed, calls onFatal once ✓
- (10) done resolves on all exit paths (stopped, failed) ✓

### NaiveRisk [packages/risk/src/naive-risk.ts:13-18]
- Two awaits: read(accountId), then write(accountId, next) ✓
- Calls shared decide(acct, request) ✓
- No loop, no concurrency control ✓
- Header: "PROTOTYPE (Week 4). Intentionally buggy comparison" ✓

### SerializedRisk [packages/risk/src/serialized-risk.ts:35-58]
- Uses BoundedQueue ✓
- Single loop: await queue.dequeue() ✓
- One message at a time: read → decide → write → resolve ✓
- Error handling: domain errors reject message, infrastructure errors => FAILED, close queue ✓
- Both call shared decide() ✓

## Test Inventory

| ID | File:Line | Title | Status | Evidence |
|---|---|---|---|---|
| SH1-SH14 | shard-runner.test.ts:* | ShardRunner suite | PASS | 14/14 tests pass; timestamps, sequencing verified |
| SP1, SP2 | runner.properties.test.ts:* | Properties | PASS | 2/2 pass; 500+ runs (SP1), 1000+ runs (SP2) |
| RK1 | risk.test.ts:80 | SerializedRisk failure behavior | PASS | Error handling, message rejection verified |
| C2 | risk.test.ts:52 | Naive overspend proof | PASS | committed > cash (160 > 100), held ≠ committed (80) |
| C2b | risk.test.ts:61 | Serialized prevents overspend | PASS | First 80 accepted, second 80 rejected |
| C6 | risk.test.ts:69 | Deterministic schedules | PASS | 200 runs, serialized never overspends |
| Week 3 (P1-P14, U1-U34, Q1-Q8) | engine-core/test/* | Regression | PASS | 81 tests pass (same as Week 3) |

**No test evasions found** (.skip, .only, .todo, setTimeout, Math.random absent in test/shard/src, test/risk/src, test/common/src).

## Boundaries & Browser Safety

- grep "Promise.all\|forEach(async\|\.map(async" packages/shard/src packages/risk/src packages/common/src: **0 hits** ✓
- grep "node:\|setTimeout\|setInterval\|setImmediate\|queueMicrotask\|process\|Buffer" packages/common/src: **0 hits** ✓
- NaiveRisk header: ✓ marked PROTOTYPE

## Documentation

- **docs/decisions.md**: 231 lines; includes decisions #1 (single writer), #2 (stamp on dequeue), #3 (journal before apply), #4-#12 (backpressure, yield, fail-stop, ports, queue design, risk scope, race testing, benchmarks, ticks deferred) ✓
- **docs/WEEK-4.md**: Spec matches implementation (no deviations) ✓
- **PROGRESS.md**: Week 4 section present with implementation notes ✓
- **docs/versions.md**: Node 24 LTS, tinybench pinned ✓

## CI

.github/workflows/ci.yml verified:
- Node 24 ✓
- npm ci, build, lint, check:boundaries, test ✓
- Benchmarks and flake gate NOT in main test job ✓

## Findings

**No blockers. No mutations tested** (audit limited to read-only; mutations require worktree).

## Items Requiring Human Verification

Per audit spec Step 12 (hand-written pieces):
1. ShardRunner.run() — line-by-line explanation aloud (stamping, journal ordering, yield semantics)
2. NaiveRisk — two-await race timeline (read stale snapshot, parallel writes, lost update)
3. SerializedRisk — why single loop + awaited write fixes it
4. Whiteboard naive-race timeline and serialized fix
5. Run `npm run bench:e2e` on quiet machine; confirm serialized overspend == 0, naive overspend > 0 in concurrent cells

---

**Audit completed**: 1c334c9..dfd0402. All gate checks passed. Engine untouched. Implementations match spec. Tests comprehensive. No new dependencies. Docs complete.

**Status**: Week 4 ready for interview prep and final benchmarking run.
