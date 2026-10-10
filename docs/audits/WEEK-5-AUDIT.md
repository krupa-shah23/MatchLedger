# Week 5 Audit Report

**Verdict: INCOMPLETE — Definition of Done NOT MET**

| Status | Count | Notes |
|--------|-------|-------|
| DONE | 2/56+ | SN1-SN10, P15 (snapshot contract) |
| UNPROVEN | 2 | recoverStream, recoverShard (coded, no tests) |
| PARTIAL | 1 | ShardRunner.afterBatch + recovered option (framework only) |
| NOT STARTED | 51+ | CD1-CD9 codecs, J1-J14 journal, PG1-PG4, SS1-SS7, OR1-OR6, RC1-RC12, SH16-SH18, P7/P8, R1-R6, chaos, benchmarks |

**Crash recovery:** Untestable—no durable journal layer. `recoverStream()` has no real test harness (Postgres integration tests missing).

---

## Gate & Test Inventory

**npm test results:**
- Test Files: 16 pass | 5 skip (21 total)
- Tests: 92 pass | 27 skip (119 total)
- Build: ✓ | Lint: ✓ | Boundaries: ✓

**Skipped test files:** 5
- `shard/test/shard-runner.test.ts` — RUN_WEEK4 guard
- `risk/test/risk.test.ts` — RUN_WEEK4 guard  
- `spike4.integration.test.ts` — RUN_KAFKA_SPIKE
- `postgres.integration.test.ts` — RUN_CONTAINERS
- `spike7.test.ts` — RUN_INTEGRATION

**Snapshot tests (SN1-SN10, P15):** 11/11 pass ✓

**Missing Week 5 IDs:** 45 test cases (CD, MG, PG, J, SS, OR, RC, SH16-18, P7-P8, R1-R6 not present)

---

## Deliverables Status

| Item | Status | Evidence |
|------|--------|----------|
| **Engine: snapshot API** | DONE | orderBook.ts:152-248 snapshot/restore, SN1-10 ✓ |
| **Engine: property P15** | DONE | properties.snapshot.test.ts 1 pass ✓ |
| **recovery.ts** | UNPROVEN | recovery.ts:81-271 recoverStream/recoverShard coded; no Postgres tests |
| **recoverStream spec compliance** | ? | Reads snapshot candidates, replays, detects gaps/mismatches—untested |
| **Codecs (CD1-CD9)** | NOT STARTED | common/src/codec/ does not exist |
| **Migrations 001-003** | NOT STARTED | journal/migrations/ does not exist |
| **Pool + bigint parser** | NOT STARTED | pool.ts missing |
| **PgJournal** | NOT STARTED | pg-journal.ts missing |
| **SnapshotStore** | NOT STARTED | snapshot-store.ts missing |
| **OrderRequestStore** | NOT STARTED | order-request-store.ts missing |
| **SeqDeduper** | NOT STARTED | seq-deduper.ts missing |
| **DurableEventSink** | NOT STARTED | durable-event-sink.ts missing |
| **Integration tests** | NOT STARTED | No J1-J14, PG1-PG4, SS1-SS7, OR1-OR6, RC1-RC12, SH16-SH18, P7-P8 |
| **Chaos tests R1-R6** | NOT STARTED | No CP1-CP5 crash harness, no R1b SIGKILL script |
| **Recovery benchmark** | NOT STARTED | benchmarks/src/recovery.bench.ts missing |
| **Vitest projects** | PARTIAL | vitest.config.ts has no `projects:` for unit vs integration split |

---

## Contract, Boundaries, Purity

**recovery-types.ts (common/src):** ✓ Correct location, exports RecoveredState, SnapshotStore, BookPort, AfterBatchContext, JournalReader.

**OrderBook methods:**
- `snapshot():BookSnapshot` — returns immutable snapshot with version, spec, next counters, bids/asks in canonical order
- `restore(spec, snap):OrderBook` — validates version, spec match, counters, empty levels, FIFO order, crossed book; all-or-nothing

**ShardRunner integration:**
- `recovered` option (type RecoveredState) — loads books, seqBySymbol, lastTs ✓  
- `afterBatch` hook — called after sink.publish, before yieldFn ✓ (cf. shard-runner.ts:147-150)  
- `Stamper.restore(seqBySymbol, lastTs)` — implemented (stamper.ts:1-7) ✓

**Engine-core purity:**
- No changes to eslint config ✓  
- snapshot.ts types only (no I/O, async, clock)  
- orderBook.ts +96 lines (snapshot/restore), no imports added ✓  
- `git diff bdc96c7..HEAD -- packages/engine-core/src` shows only snapshot.ts, orderBook.ts, index.ts ✓

**Dependencies (new this week):**
- `pg` (8.23.1) listed in journal/package.json ✓  
- `@types/pg` (8.23.1) devDependency ✓  
- No new imports in common (still browser-safe) ✓

---

## Test Inventory by ID

### Snapshot & Engine (DONE)
| ID | Location | Status |
|----|----------|--------|
| SN1-SN10 | engine-core/test/snapshot.test.ts:* | PASS (10/10) |
| P15 | engine-core/test/properties.snapshot.test.ts | PASS (1/1) |

### NOT PRESENT (45+ tests)
| Family | IDs | Tests | Status |
|--------|-----|-------|--------|
| **Codec & migrations** | CD1-CD9, MG1-MG3, PG1-PG4 | 16 | MISSING |
| **Journal & stores** | J1-J14, SS1-SS7, OR1-OR6 | 27 | MISSING |
| **Recovery integration** | RC1-RC12, SH16-SH18 | 14 | MISSING |
| **Properties** | P7, P8 | 2 | MISSING |
| **Chaos & dedupe** | R1-R3, R6, CP1-CP5 | 5+ | MISSING |

---

## Code Review: recoverStream & recoverShard

**recoverStream (journal/src/recovery.ts:81-227)** — UNPROVEN

Reads:
- ✓ `journal.lastCommandSeq(symbol)` → maxSeq (max 0)
- ✓ `snapshots.listCandidates(symbol, {maxSeq})` newest-first
- ✓ Checks valid: ahead-of-journal, checksum, version, restore invariants
- ✓ Falls back to fresh `Engine(spec)`
- ✓ `journal.readCommands(symbol, lastSeq, chunkSize)` streamed
- ✓ Gap check: `cmd.seq !== lastSeq + 1` throws `JournalGapError`
- ✓ Event verification: canonical JSON compare, throws `ReplayMismatchError`
- ✓ Regenerated events returned
- ✓ `lastTs = Math.max(lastTs, cmd.ts)` ✓
- ✓ No clock reads, no Promise.all, errors not swallowed
- ✗ **NO TESTS:** no way to verify against real Postgres or the crash-window table

**recoverShard (recovery.ts:229-271)** — UNPROVEN
- ✓ Loops per-symbol, awaits recoverStream
- ✓ Accumulates regenerated, `lastTs = max`
- ✗ **NO TESTS**

**Verdict:** Logic appears sound (matches spec 4.5); untestable without journal implementation and RC1-RC12 harness. A single Postgres test (RC1) would unlock all recovery tests.

---

## Mutations Not Run

No worktree created (codecs, journal, snapshots, chaos do not exist to mutate).

---

## Regression: Weeks 1-4

**All prior test IDs still pass:**
- U1-U34, EX1-EX3, Q1-Q8 (Week 3): ✓ (81 tests)
- P1-P4, P11-P14 (Week 3): ✓
- D1 (reference matcher): ✓
- BQ1-BQ6 (Week 4): ✓
- SH1-SH15, SP1, SP2 (Week 4): ✓
- C2, C2b, C3, C5, C6, RK1 (Week 4): ✓

**WebSocket flake (Spike 5):** Fixed in api/src/index.test.ts (c794f9a: "fix: stabilize websocket auth flake"). Socket waits for 'open', auth timeout injected, teardown closes sockets/server.

---

## Benchmarks, Chaos, Docs

| Item | Status |
|------|--------|
| `recovery.bench.ts` | NOT STARTED |
| `scripts/chaos-kill.mjs` | NOT STARTED |
| `chaos-child.ts` | NOT STARTED |
| `docs/decisions.md` — decisions 1-16 | **Decisions 1-16 present**; decision 26 added (websocket flake fix) |
| `docs/week-5.md` | ✓ Present (100 KB spec) |
| `PROGRESS.md` | ✓ Updated; claims snapshot/recovery done; missing journal/integration caveat |

**Benchmark hypotheses (H1-H4):** Not committed to docs/experiments.md; no recovery benchmark exists.

---

## CI & Workflows

`.github/workflows/ci.yml`: Node 24, npm ci, build, lint, check:boundaries, test ✓

No separate `integration` job; postgres.integration.test.ts and spike7.test.ts are skipped in main test unless `RUN_CONTAINERS=1`.

---

## FINDINGS

### BLOCKERS

1. **Week 5 infrastructure missing.** CD1-CD9 codecs (commands, events, versioning), migrations 001-003, pool.ts (int8 parser), PgJournal, snapshot-store.ts, order-request-store.ts, seq-deduper.ts, durable-event-sink.ts do not exist. **Impact:** No journal layer; recovery.ts cannot run; 45+ tests cannot be written. **Fix:** Implement Prompt 1 (codecs/migrations/pool) and Prompt 3 (journal/stores).

2. **recoverStream untestable.** Coded but unproven. No Postgres harness (RC1-RC12 integration tests). **Impact:** Crash-recovery claim cannot be defended. **Fix:** Build journal stack, write RC1-RC12.

3. **Integration tests missing.** vitest.config.ts has no `projects:` split; postgres.integration.test.ts and spike7.test.ts skip by default. **Impact:** Docker-based tests cannot run in `npm test`. **Fix:** Add `projects: [{name:'unit',...}, {name:'integration', include:['**/*.int.test.ts']}]`, move postgres.integration.test.ts to .int.test.ts.

4. **P7, P8 property tests missing.** Spec calls for replay-equals-live (P7 over Postgres) and replay-with-throwing-Date (P8). **Impact:** Recovery determinism unproven. **Fix:** Write P7 (50+ runs, journal harness) and P8 (different wall clocks).

5. **Chaos tests absent.** R1 (CP1-CP5 crash points, in-process), R1b (SIGKILL script), R2-R3, R6 do not exist. **Impact:** Headline claim "kill at any crash point, recover exactly" unproven. **Fix:** Build chaos.ts and scripts/chaos-kill.mjs.

### SHOULD FIX

6. **SeqDeduper** (R3 dedupe test) and **DurableEventSink** (event journaling) are in the spec but not coded. **Impact:** R3 (duplicate delivery) and cascade (journal → verify → downstream) cannot be tested. **Fix:** Prompt 3 includes these.

7. **Benchmark (R6)** no hypotheses, no recovery.bench.ts. **Impact:** Recovery-time claim has no numbers. **Fix:** Commit H1-H4 to experiments.md (before runs), implement recovery.bench.ts.

8. **docs/experiments.md** Week 5 section missing hypotheses (H1-H4). **Impact:** Benchmark runs will not have pre-committed predictions. **Fix:** Add before running.

### NICE TO HAVE

9. Vitest project split (unit vs integration) as per spec 9 deferred to later.

---

## HUMAN-ONLY ITEMS

1. Explain `OrderBook.snapshot()` and `restore()` line by line: validation, FIFO order, canonical ordering, checksum.
2. Explain `recoverStream()` line by line: snapshot selection, command tail replay, event verification, regenerated events.
3. Draw the crash-window table (CP1-CP5) from memory; explain durable state and recovery action for each.
4. Run any benchmark on a quiet, plugged-in machine before quoting recovery times.

---

## REMAINING WORK (Mapped to Prompts)

### MUST DO BEFORE WEEK 5 DONE

**Prompt 1 (Foundations):** CD1-CD9 codecs, MG1-MG3 migrations, PG1-PG4 pool/bigint. **Tests:** CD, MG, PG must green. **Blocker:** All downstream depends on journal.

**Prompt 3 (Journal & Stores):** PgJournal, snapshot-store.ts, order-request-store.ts, seq-deduper.ts, durable-event-sink.ts. **Tests:** J1-J14, SS1-SS7, OR1-OR6 must pass. **Dependency:** Prompt 1.

**Prompt 4 (Recovery Tests):** RC1-RC12 (snapshot + tail, gap, mismatch, torn snapshot, multi-symbol), SH16-SH18 (runner afterBatch), P7-P8 (replay determinism). **Dependency:** Prompts 1 & 3.

**Prompt 5 (Chaos & Mutations):** R1 in-process crash points CP1-CP5, R1b SIGKILL script, R2-R3, R6 benchmark, mutation checks. **Dependency:** Prompts 1-4.

**Prompt 6 (Docs):** Decisions 1-16 recorded, benchmark hypotheses H1-H4 committed (before runs), PROGRESS.md updated.

### RECOMMENDED

- Vitest projects split (unit, integration) once integration tests exist.
- CI integration job (docker compose, Postgres-dependent tests).

### SAFE TO DEFER (WEEK 6+)

- Spike 4 (Kafka fencing) — optional, note in PROGRESS.md if skipping.
- Ledger (Week 7) — depends on risk stage.
- Reconciliation (Week 8) — depends on ledger.

---

## Verification & Status

**Audit scope:** Read-only. Code review of recoverStream/snapshot, inventory, spec conformance.

**Uncommitted:** package.json (+test:flake script), packages/engine-core/src/book/orderBook.ts (+snapshot/restore impl, +spec field, +counters). These are part of Week 5 work but not yet committed. **Finding:** Snapshot tests pass (SN1-SN10, P15 green) against uncommitted code. After committing, git status will show only this audit file.

**Work remaining:** ~40 hours for Prompts 1, 3, 4, 5, 6 to reach "After random kills, recovered state equals the uninterrupted run."

**Next:** Commit Week 5 snapshot work; begin Prompt 1. Implement codecs; after CD green, codecs unblock everything else.

