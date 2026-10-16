# Week 8 Prompt Pack for GitHub Copilot (5 prompts)

Use these in order, in **Copilot Chat, Agent mode** in VS Code (they also work in Claude Code), with the repo root open. Each prompt is self-contained and ends with a report format. Do not start prompt N+1 until prompt N is green and **you** have committed it (see "Your commits" at the end; the agent never commits).

Spec the agent must read first: `docs/WEEK-8.md` (put the file from this pack there), `docs/WEEK-5.md`, `docs/WEEK-6.md`, `docs/WEEK-7.md`, `docs/BLUEPRINT.md`, `AGENTS.md`, `PROGRESS.md`.

## Before you start

1. **Week 5 must be proven** (journal, codecs, snapshot store, `recoverStream`, RC1 to RC12, P7, R1 green against Postgres). Run `FULL-AUDIT-PROMPT.md` if you are unsure. Prompt 1 checks this and stops if it is not true. Weeks 6 and 7 must also be green.
2. **Docker and Postgres 18** must be running (this week is mostly integration tests).
3. **Persist the hard rules** in `.github/copilot-instructions.md` (paste the HARD RULES block from the shared preamble).
4. **Attach the spec** in every prompt (`#file:docs/WEEK-8.md`).
5. **You commit, not Copilot.** No prompt tells the agent to run `git commit` or `git push`. After each prompt is green you run the commit yourself with the message from "Your commits" at the end, so GitHub shows you as the author. `engine-core` must show **no diff** this week.
6. **Schedule note.** This week is durability first. The API, WebSocket and read side move to Week 9 (explained in `WEEK-8.md`).

## How authorship works this week

Your Week 8 rule: you hand-write **`RiskCore.restore()`**: validate first, build second, check invariants last, return the core only at the very end (the risk twin of `OrderBook.restore()`). The prompts default to `MODE: STUB`: the agent writes everything else, creates the stub and an exact spec for `restore`, **stops**, and reviews your code when you say `REVIEW` (without rewriting it). To relax the rule, change `MODE: STUB` to `MODE: IMPLEMENT`.

## Scope and split points

| # | Prompt | Output | Gate |
|---|--------|--------|------|
| 1 | Foundations: boundaries, migrations, `SqlExecutor`, risk codecs, `PgRiskJournal`, `DurableRiskOutbox` | RCD1 to RCD6, MG4, RJ1 to RJ8, DO1 to DO3 | Week 5 proven; boundary proofs |
| 2 | Risk state: tests first, then YOU write `restore()`; snapshots; `recoverRiskPartition` | RX1 to RX7, RCD7, P24, RSS, RSC1, RR1 to RR12 | **Split point 1**: risk durable alone |
| 3 | Durable ledger, order owners, durable reconciliation, ledger catch-up | LP1 to LP9, OW1 to OW4, LC1 to LC6, RDB1 to RDB8 | Ledger and recon durable |
| 4 | `runtime` package, `recoverPipeline`, crash-point tests, end-to-end properties | RM1 to RM4, PR1 to PR6, RCP1 to RCP7, P25, P26, P19x | **Split point 2**: pipeline recovery proven |
| 5 | `SIGKILL` pipeline chaos, mutations, docs, final gate | R1c, mutation table | Full verification gate |

Prompt 4 is the heaviest; it has internal stopping points. If you are short on time, stop after Prompt 2 or Prompt 4.

---

## Shared preamble (paste at the top of EVERY prompt)

````text
#file:docs/WEEK-8.md #file:docs/WEEK-5.md #file:docs/WEEK-6.md #file:docs/WEEK-7.md #file:docs/BLUEPRINT.md #file:AGENTS.md #file:PROGRESS.md

You are working in the MatchLedger monorepo (Node.js 24 LTS, npm workspaces, TypeScript 6.0.x strict with noUncheckedIndexedAccess and verbatimModuleSyntax, Vitest 4.1.x, fast-check 4.x, ESLint 10 flat config, PostgreSQL 18). We are implementing Week 8: durability across the whole pipeline (risk, ledger, reconciliation) and end-to-end crash recovery.

READ FIRST, before changing anything: docs/WEEK-8.md (the spec: schema 4.2, risk state 4.3, crash windows 4.4, recoverPipeline 4.5, ledger 4.6, recon 4.7, dependency changes 4.8, tests 8.x), docs/WEEK-5.md (the engine journal, codecs, snapshots, recovery you will reuse), docs/WEEK-6.md and WEEK-7.md (risk core, router, stage, ledger, breaker, recon core), and the existing code: packages/journal (pool.ts, pg-journal.ts, snapshot-store.ts, recovery.ts, migrations), packages/common (codec/*, recovery-types.ts, risk-types.ts, seq-deduper.ts, async-queue.ts), packages/risk (core/risk-core.ts, stage.ts, router.ts, market-view.ts, sweeper.ts), packages/ledger, packages/recon, packages/shard (shard-runner.ts, tick-injector.ts), packages/system-tests (src/wire.ts and tests), scripts/check-boundaries.mjs, eslint.config.js, scripts/flake-gate.mjs, vitest config. Reuse the exact exported names. If the code and the docs conflict, follow the code and tell me.

MODE: STUB
(STUB = for the one piece I hand-write, RiskCore.restore(), create a stub plus exact spec and STOP; I will write the code and then say REVIEW. IMPLEMENT = you also write it.)

HARD RULES
1. packages/engine-core is UNCHANGED this week and ShardRunner.run() is untouched. `git diff` on engine-core must be empty. If you believe a change is needed, stop and explain why.
2. PURE ZONES stay pure: packages/risk/src/core/**, packages/ledger/src (pure ledger), packages/recon/src/core/** (no clock, Math.random, process, timers, async/await/Promise, node:*; imports relative or `import type` from @matchledger/common). Persistence adapters live OUTSIDE the cores. packages/common stays browser-safe (no node:*, no timers, no crypto). Hashing and crypto live in journal or the adapters.
3. NO new npm dependencies. The only new workspace is packages/runtime (composition root). Only packages/journal may import `pg`; risk, ledger, recon and runtime use the `SqlExecutor` TYPE exported by journal. Respect docs/WEEK-8.md 4.8 and keep `npm run check:boundaries` green.
4. Money, prices, quantities, reservations, ledger amounts are bigint. seq and ts are number. NEVER JSON.stringify an object that can contain a bigint: go through the codecs. Use Map and Set for keyed state. Never register a global pg type parser (pool-scoped only).
5. Journal and store writes are ATOMIC OR ABSENT: one statement or one transaction per batch; no loops of single inserts. Decoding is STRICT (no permissive parsers, unknown fields rejected).
6. No Promise.all, forEach(async ...) or unawaited work over ordered operations in journal, risk, ledger, recon and runtime source. Tests may launch independent concurrent tasks where a test explicitly requires it.
7. ReplayMismatchError, JournalGapError, InvalidRiskStateError and OwnerMissingError are FATAL: never catch and swallow them.
8. Unit tests never require Docker. Postgres tests are *.int.test.ts and run only in the integration project (npm run test:integration), each file with its own unique schema. All tests are DETERMINISTIC: no real sleeps, no setTimeout, no Math.random; fast-check generates flows, crash plans and delay schedules; use gates and injected yields. Never add retries.
9. Never change an existing test to make it pass unless the test itself is wrong; if you think it is, say why and ask first. Do not weaken ESLint rules. Every earlier test (including C2, C1, C1b, K10 to K12, R4, P7, P8, R1 to R3) must keep passing UNMODIFIED.
10. Do not add features beyond the prompt: no fencing enforcement (writer_epoch is only recorded), no Kafka, no HTTP API, no WebSocket, no projections, no bounded dedupe sets, no multi-account atomic adjustments.
11. Work in small steps. After each step run: npm run build, npm run lint, npm run check:boundaries, npm test, and npm run test:integration. Fix failures before continuing.
12. Do not invent numbers. Anything reported as measured must come from a command you ran, with its output.
13. Update PROGRESS.md at the end of the prompt: what was done, how verified, deviations from the docs, next failing test or next step.
14. GIT: NEVER run `git commit`, `git push`, `git add`, `git stash`, `git reset`, `git clean`, `git checkout -- <path>`, `git restore`, `git switch`, `git branch`, `git merge`, `git rebase` or `git worktree`, and never add a Co-authored-by trailer. Read-only git commands (status, diff, log, show, rev-parse) are fine. I commit myself. When a step or prompt is green, say so and stop; do not stage or commit anything.

REPORT FORMAT at the end: (a) files created/changed, (b) commands run and results, (c) tests added with IDs, (d) deviations or doubts, (e) exactly what the next prompt should start from.
````

---

## Prompt 1: Foundations, risk codecs, `PgRiskJournal`, `DurableRiskOutbox`

````text
[PASTE THE SHARED PREAMBLE HERE]

PRECONDITION: Weeks 5, 6 and 7 are green. Docker and Postgres 18 are running.

TASK: (1) verify Week 5 is really proven, (2) boundaries and the new workspace skeleton, (3) migrations 004 to 007 and shared SQL helpers, (4) strict versioned risk codecs, (5) PgRiskJournal and DurableRiskOutbox. Tests first.

STEP 1: Verification (stop if it fails)
Run from clean: npm ci && npm run build && npm run lint && npm run check:boundaries && npm test && npm run test:integration, then `npm run test:flake` (unit and integration). Confirm by reading the test results that these exist and pass: PgJournal tests J1 to J14, snapshot store SS1 to SS7, recovery RC1 to RC12, P7, R1. If any of them is missing, skipped or failing, STOP and tell me exactly which; do not build on a shaky Week 5. Report the Postgres version and `docker compose ps`.

STEP 2: Dependency map, boundaries, workspace skeleton (one logical change)
- Update scripts/check-boundaries.mjs AND docs/BLUEPRINT.md 4.4 together: risk, ledger and recon MAY now depend on journal; they still must NOT import `pg` (only journal may); a NEW workspace packages/runtime (composition root) may depend on engine-core, common, journal, shard, risk, ledger, recon; ONLY system-tests may depend on runtime (and later api); note the thirteenth workspace and why in the blueprint.
- Create packages/runtime (package.json private with the workspace deps, tsconfig with project references, src/index.ts exporting nothing yet, one smoke test importing from each dependency) and add it to the root workspaces, tsc -b references, the unit project and the default paths of scripts/flake-gate.mjs.
- Proofs (then revert, show outputs): add `pg` to packages/risk/package.json => check:boundaries FAILS; add a dependency on runtime from packages/risk => FAILS; add `import 'pg'` in packages/ledger/src => lint or checker FAILS.

STEP 3: SqlExecutor, migrations, shared SQL helpers (packages/journal)
- src/sql-executor.ts: `export interface SqlExecutor { query<R = unknown>(text: string, params?: readonly unknown[]): Promise<{ rows: R[]; rowCount: number }>; transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> }` and `toExecutor(pool: Pool): SqlExecutor` (transaction acquires a client, BEGIN/COMMIT/ROLLBACK, releases the client in finally; nested transaction calls on the tx executor reuse the same client). Export from the index. Tests (integration): query passes params and returns rows; transaction commits on success; rolls back on throw and rethrows; a failed statement inside a transaction rolls everything back; nested use does not open a second connection.
- Migrations 004 to 007 EXACTLY as in docs/WEEK-8.md 4.2 (004_order_owners, 005_ledger_entries, 006_recon, 007_journal_indexes). For 007, FIRST read what the Week 5 codec actually emits for command and event payloads (look at serializeCommand/serializeEvent output and a real row) and adapt the JSON paths if the payload shape differs from the doc; state what you adapted.
 MG4 (integration): migrations 004 to 007 apply in order on top of 001 to 003, a second run is a no-op, checksums are recorded (extends MG1 to MG3).
- Extract shared low-level helpers from PgJournal into src/stream-sql.ts WITHOUT changing behavior: an unnest-based command insert, an events insert with ON CONFLICT DO NOTHING plus compare, a keyset command read, an events-by-range read, lastCommandSeq. They take a SqlExecutor, a stream id and already-serialized payload strings, so both the engine journal and the risk journal can use them. PgJournal is refactored to use them. ALL existing journal tests (J1 to J14 etc.) must pass UNMODIFIED.

STEP 4: Risk codecs (packages/common/src/codec/risk-commands.ts and risk-events.ts; browser-safe)
Same style as the engine codecs (read them first): `serializeRiskCommand` / `deserializeRiskCommand` and `serializeRiskEvent` / `deserializeRiskEvent`, payload `{ v: 1, type, ...fields }`, every bigint a decimal STRING within the int8 bounds, EXHAUSTIVE switch with an assertNever default over EVERY RiskCommand and RiskEvent type currently in common/risk-types.ts (including Week 7's SymbolStatusChanged, ApplyAdjustment, AccountAdjusted, AdjustmentRejected, and any others you find; list them in your report), deterministic key order via canonicalJson, STRICT decode (unknown type, missing or extra field, wrong JS type, non-canonical decimal, bad enum => CodecError naming the field), upcaster registry support as in versioning.ts. `SubmitOrder.market` is an object with OPTIONAL fields (lastTradePrice, lastTradeTs, bestBid, bestAsk): absent stays absent after a round trip (never null, never "undefined" strings); `price?` likewise.
Tests (unit):
 RCD1 Property (numRuns >= 2000): random risk commands of every type (bigint above 2^53) serialize, JSON.stringify, JSON.parse, deserialize: deep-equal.
 RCD2 Same for every risk event.
 RCD3 Strictness: each malformation throws a typed CodecError naming the field.
 RCD4 Optional MarketInput and price fields: absent stays absent; present zero stays zero.
 RCD5 Versioning and determinism: payloads carry v: 1; unknown version throws UnknownSchemaVersionError; same value serializes to the identical canonical string regardless of key insertion order.
 RCD6 Exhaustiveness: compile-time check (explain in a comment how adding a type breaks the build).
(RCD7, the RiskState codec, is in Prompt 2.)

STEP 5: PgRiskJournal and DurableRiskOutbox (packages/risk/src/persistence; uses journal's SqlExecutor and helpers; NOT inside risk/src/core)
```ts
export class PgRiskJournal implements RiskJournalAppender {
  static create(db: SqlExecutor, opts: { partitions: number; writerEpoch: bigint; defaultChunkSize?: number; upcasters?: UpcasterRegistry }): Promise<PgRiskJournal>;
  append(batch: readonly StampedRiskCommand[]): Promise<void>;                       // stream_id 'risk-<partition>'
  appendEvents(outputs: readonly RiskOutput[]): Promise<void>;                       // EVENT rows; plus order_owners for OrderAccepted, SAME transaction
  lastCommandSeq(partition: number): Promise<number>;
  readCommands(partition: number, afterSeq: number, chunkSize?: number): AsyncGenerator<readonly StampedRiskCommand[]>;
  readEvents(partition: number, fromSeq: number, toSeq: number): Promise<ReadonlyMap<number, readonly RiskEvent[]>>;
  findOrderAccepted(partition: number, orderId: string): Promise<Extract<RiskEvent, { type: 'OrderAccepted' }> | undefined>;
}
export class DurableRiskOutbox implements RiskOutbox { constructor(journal: PgRiskJournal, downstream: RiskOutbox); publish(partition, outputs): Promise<void> /* appendEvents first, THEN downstream.publish, sequentially */ }
```
Behavior mirrors PgJournal (Week 5): per-partition contiguity validated before any write (first seq equals tracked last + 1), one unnest statement per append with no ON CONFLICT (23505 => JournalConflictError, whole batch rolled back), tracked lastSeq updated only after success, create() loads lastSeq per partition, keyset reads with chunking and strict decode plus ts-column integrity check, events inserted in ONE transaction with ON CONFLICT DO NOTHING then compared canonically (different content => JournalConflictError and rollback), writer_epoch recorded not enforced. NEW: within the appendEvents transaction, for every `OrderAccepted` event also `INSERT INTO order_owners (order_id, account_id, symbol, side) ... ON CONFLICT (order_id) DO NOTHING` and then verify the stored owner row equals the event's (account, symbol, side); a conflicting owner => OrderOwnerConflictError and rollback. findOrderAccepted uses the expression index on the orderId path.
Tests (integration, each file its own schema; start from truncated tables):
 RJ1 Append commands for partitions 0 and 1: rows have stream_id risk-0 / risk-1, record_type COMMAND, idx 0, schema_version 1, correct ts and writer_epoch; payloads decode to the originals.
 RJ2 Gap, duplicate or wrong start seq in a batch: JournalSequenceError before any write; nothing persisted; tracked lastSeq unchanged.
 RJ3 A batch whose last row conflicts with an existing row: JournalConflictError, no row from the batch exists.
 RJ4 A 10,000-command batch is ONE statement (query spy).
 RJ5 appendEvents: idx 0..n-1 per output; identical re-append is a no-op; a different payload for the same key => JournalConflictError and nothing changes.
 RJ6 readCommands chunking (chunkSize 3 over 10 commands), ordering by seq, bigint intact; readEvents grouping and idx contiguity check.
 RJ7 Connection failure mid-append (wrapper that rejects once or pg_terminate_backend): rejects, nothing recorded, tracked lastSeq unchanged.
 RJ8 Index use: seed 5,000 EVENT rows and 5,000 COMMAND rows, run `EXPLAIN` on the order-id lookups (findOrderAccepted and a command lookup by order id) and assert the plan uses the expression index (an Index Scan or Bitmap Index Scan on journal_evt_order / journal_cmd_order, not a Seq Scan); document that this depends on enable_seqscan staying default and table statistics (run ANALYZE in the test).
 DO1 DurableRiskOutbox: with a downstream spy, events are journaled BEFORE the downstream call (assert order); if appendEvents rejects the downstream is NOT called and the error propagates.
 DO2 An OrderAccepted event inserts the order_owners row in the same transaction: force the events insert to fail after the owner insert (conflicting event) and assert NO owner row exists; and force a conflicting owner and assert no event rows were persisted.
 DO3 Idempotent re-publish: publishing the same outputs twice leaves one set of event rows and one owner row.

STEP 6: Verify
build, lint, check:boundaries, npm test, npm run test:integration, npm run test:flake (unit and integration): 20/20. Confirm engine-core and shard have no diff and Week 5 journal tests pass unmodified. Report RCD1 to RCD6, MG4, SqlExecutor tests, RJ1 to RJ8, DO1 to DO3. Do not commit; tell me it is ready.
````

---

## Prompt 2: Risk state (tests first, then YOU write `restore()`), snapshots, recovery

````text
[PASTE THE SHARED PREAMBLE HERE]

PRECONDITION: Prompt 1 committed by me and green.

TASK: Add RiskCore.exportState(), write ALL state and recovery tests first, then (MODE) restore() gets written, then snapshots and recoverRiskPartition. This is split point 1: after this prompt the risk stage is durable on its own.

STEP 1: Types, errors, exportState (you may write these fully)
- packages/common/src/risk-types.ts: add `RiskState` exactly as docs/WEEK-8.md 4.3 (instruments copy with every InstrumentRiskConfig field; accounts sorted by id then positions by symbol; reservations by placedSeq with sorted appliedTradeIds; decidedOrders, seenRequestIds, seenAdjustmentIds, haltedSymbols as sorted string arrays). If the Week 7 core stores adjustment ids or halted symbols under different names, use the real names and tell me.
- packages/risk/src/core/errors.ts: `InvalidRiskStateError extends Error` with `reason`: 'VERSION' | 'CONFIG_MISMATCH' | 'DUPLICATE_RESERVATION' | 'UNKNOWN_ACCOUNT' | 'RESERVATION_NOT_DECIDED' | 'AMOUNT_MISMATCH' | 'HELD_MISMATCH' | 'OVER_HELD' | 'NEGATIVE' | 'INVARIANT'.
- RiskCore: `exportState(): RiskState` (pure, canonical, plain data with NO references into the live core, sets sorted lexicographically) and `static restore(config: RiskConfig, state: RiskState, partition?: number): RiskCore`. The existing `snapshot()` from Week 6 is UNCHANGED.
IF MODE: STUB: restore's body is `throw new Error('RiskCore.restore: hand-written (docs/WEEK-8.md 4.3)')`. Everything else compiles; pure-zone lint stays green; earlier tests green.

STEP 2: Tests, written BEFORE restore exists (packages/risk/test/risk-state.test.ts and a property file). Use the Week 6 helpers (cfg(), stamp(), open(), expectHealthy) and the Week 6 Scenario 1 numbers. They fail only because restore is a stub.
RX1 exportState is canonical: two cores that reached the same state by different command orders (e.g. deposits in different order) export deep-equal states; calling it twice is identical; arrays sorted as specified.
RX2 Isolation: mutate the core after exportState (further commands): the exported state is unchanged; mutate a deep copy of the state after restore: the restored core is unaffected.
RX3 Restore of an empty core's state: healthy empty core; same config.
RX4 Week 6 Scenario 1: run submit (reserve 1050) and the 4 @ 101 fill, export, restore, then apply OrderClosed{remaining 6}: identical events and final balances to the uninterrupted core (cash 9596, held 0).
RX5 Dedupe state survives restore: after restore, a duplicate SubmitOrder (open, closed and rejected orders) is DuplicateIgnored; a duplicate FillApplied for an open reservation is DuplicateIgnored; a duplicate Deposit requestId and duplicate ApplyAdjustment adjustmentId are ignored; a halted symbol still rejects SYMBOL_HALTED.
RX6 Malformed states, one case each, built by `corruptState(state, mutation)` from a valid state; each must throw InvalidRiskStateError with the right `reason` and return no core: version != 1 (VERSION); different instrument config (CONFIG_MISMATCH); two reservations with one orderId (DUPLICATE_RESERVATION); a reservation whose account is missing (UNKNOWN_ACCOUNT); a reservation whose orderId is absent from decidedOrders (RESERVATION_NOT_DECIDED); BUY amountRemaining != priceCap x qtyRemaining or SELL amountRemaining != qtyRemaining (AMOUNT_MISMATCH); an account's heldCash not equal to the sum of its BUY reservations, or heldShares not equal to the sum of its SELL reservations (HELD_MISMATCH); heldCash > cash or heldShares > quantity (OVER_HELD); a negative cash, quantity, qtyRemaining or amount (NEGATIVE).
RX7 checkInvariants gate: a state that passes the structural checks but would fail checkInvariants() (construct one) throws InvalidRiskStateError('INVARIANT').
P24 (fast-check, numRuns >= 1000): build random VALID command sequences by running a small generator through a real core and engine-free notice simulator: deposits, submits (LIMIT GTC/IOC and MARKET with market inputs), fills and closes that are consistent with the core's own reservations (derive each fill/close from the current `view` so no RiskInvariantError occurs), duplicates, halts/activations, adjustments; choose a random cut point k; core A runs all commands; core B runs the first k, exports, restores into C, runs the rest; assert events after k deep-equal and final exportState deep-equal and checkInvariants healthy throughout. Print the seed on failure.
RCD7 (common unit): `serializeRiskState` / `deserializeRiskState` in packages/common/src/codec/risk-state.ts (strict, v: 1, bigint as decimal strings, arrays kept in the given order, same CodecError rules): round trip deep-equal for random states produced by P24's generator (numRuns >= 500); strictness cases (extra field, wrong type, non-canonical decimal).
Run the risk and common tests and show that ONLY the tests needing restore fail (RX3 to RX7, RX4, P24) with the stub's message, and everything else passes.

STEP 3: Stop (MODE: STUB)
Do NOT commit. Print this checklist of what I must write, then STOP and wait:
 RiskCore.restore(config, state, partition):
  1. VALIDATE EVERYTHING FIRST, throwing InvalidRiskStateError with the right reason BEFORE building anything: state.version === 1; the state's instruments match config.instruments exactly (same symbols and every field) else CONFIG_MISMATCH; no duplicate reservation orderIds; every reservation's account exists; every reservation orderId is in decidedOrders; for each reservation BUY amountRemaining == priceCap x qtyRemaining, SELL amountRemaining == qtyRemaining, and qtyRemaining > 0n; for each account heldCash == sum of its BUY reservations' amountRemaining and each position's heldShares == sum of its SELL reservations' qtyRemaining; heldCash <= cash and heldShares <= quantity; no negative cash, quantity, held or amount.
  2. THEN build a NEW RiskCore (never mutate an existing one): accounts and positions into Maps, reservations into the reservations Map with fresh appliedTradeIds Sets, the four dedupe/halt sets into Sets.
  3. Run checkInvariants() on the new core; if it is not empty throw InvalidRiskStateError('INVARIANT', details).
  4. Return the new core only at the very end (all-or-nothing). Pure: no clock, no imports beyond relative and type-only, no async. Use Map and Set, bigint only.
 Also remind me to re-run the purity proof after writing it (Date.now() under risk/src/core must fail lint; revert it by editing the file back).

REVIEW (after I write restore() and say REVIEW):
- Run build, lint, check:boundaries, unit suite; report RX1 to RX7, RCD7, P24 by ID. Run P24 five times with different seeds.
- Review my restore against the checklist (PASS/FAIL/UNSURE with line refs): validation before any construction; each validation rule present with the right reason; new core built from scratch; Sets rebuilt (including appliedTradeIds); invariants gate; returned only at the end; no clock/async; no number for money.
- Hunt for: validating after building; forgetting appliedTradeIds or seenAdjustmentIds or haltedSymbols; sharing array/Map references with the input state; restoring heldCash from the state without checking it against the reservations; skipping the config check.
- Purity proof. Do not commit; tell me whether everything is green.

STEP 4 (only after I say CONTINUE following the review): snapshots, scheduler, recovery
- packages/journal/src/state-snapshot-store.ts: generalize the Week 5 snapshot store into a store parameterized by a codec `{ serialize(state): unknown; deserialize(payload: unknown): S; version: number }` with the same save / listCandidates / prune behavior (checksum over canonicalJson of the RE-SERIALIZED state; ahead-of-journal, unknown version, checksum and decode failures reported as invalid). The existing book snapshot store becomes an instance and ALL Week 5 snapshot tests (SS1 to SS7) pass UNMODIFIED. A risk instance uses stream id `risk-<partition>` and the risk state codec.
 Tests RSS1 to RSS5 (integration): round trip with exact bigints; newest valid first; corrupt checksum skipped and reported; unknown version skipped; snapshot ahead of the journal skipped.
- packages/risk/src/persistence/risk-snapshot-scheduler.ts: count-based like the Week 5 SnapshotScheduler: `afterBatch(ctx: { partition: number; lastSeq: number; lastTs: number; core: RiskCore })`: when lastSeq - lastSnapshotSeq >= everyCommands, take `core.exportState()` SYNCHRONOUSLY, then `await store.save(...)` in try/catch (failure non-fatal: call onError, keep the previous lastSnapshotSeq, retry next batch). Test RSC1 (unit, fakes): snapshots exactly when due using the context's lastSeq; failure does not throw and retries.
- RiskStage additions (packages/risk/src/stage.ts, agent-written area): option `afterBatch?: (ctx) => Promise<void>` called by each partition loop after the outbox publish and before the yield with the partition's lastSeq, lastTs and core (errors propagate to fail-stop); `RiskStamper.restore(seq: number, lastTs: number)`. Unit tests: afterBatch is called once per batch in the right position with the right context; throwing => FAILED; stamper restore continues seq and clamps ts (RR11 unit part).
- packages/risk/src/persistence/recovery.ts: `recoverRiskPartition({ journal: PgRiskJournal; snapshots: <risk snapshot store>; partition: number; config: RiskConfig; chunkSize?: number })` returning `{ partition, core, lastSeq, lastTs, replayed, verified, regenerated: readonly RiskOutput[], snapshotUsed?, invalidSnapshots }`. Algorithm = the Week 5 recoverStream, adapted: maxSeq from the journal; candidates newest first, first one that is not invalid AND restores via RiskCore.restore AND passes checkInvariants (record skipped ones with reasons); tail streamed in chunks; gap check cmd.seq === lastSeq + 1 (JournalGapError); apply the JOURNALED stamped command (its journaled ts and market input, never a clock or a view); compare stored events with regenerated ones by canonical serialization (ReplayMismatchError with a readable diff); stored events absent => push to `regenerated`; lastTs = max. `recoverRiskStage({ journal, snapshots, partitions, config })` runs partitions sequentially, appends all regenerated events via journal.appendEvents (idempotent, which also repairs order_owners), and returns the per-partition cores, lastSeq and lastTs (and the regenerated outputs for the caller). No clock, no ids, no Promise.all.
 Tests (integration; helpers: seedRiskJournal that stamps and applies commands through a reference core to produce events and writes COMMAND and EVENT rows; oracle = fresh core fed the stamped commands):
 RR1 Empty journal, no snapshot: fresh core, lastSeq 0.
 RR2 No snapshot, N=150 commands: recovered exportState equals the oracle's; replayed 150, verified 150.
 RR3 (Scenario 1) Snapshot at 100 plus tail: same final state; only the tail applied (count core.apply calls via a wrapper); snapshotUsed 100.
 RR4 Events missing for the last 5 commands: 5 regenerated outputs equal to the oracle's events; after appending them a second recovery regenerates none.
 RR5 Tampered stored event (raw SQL): ReplayMismatchError with partition, seq and diff.
 RR6 Deleted command row: JournalGapError.
 RR7 Torn snapshot (newest has a bad checksum): fallback to the previous one; identical result; invalidSnapshots lists it.
 RR8 Snapshot ahead of the journal: ignored; full replay identical.
 RR9 A snapshot that decodes and checksums but fails RiskCore.restore (corrupt a field and recompute a valid checksum): ignored with the InvalidRiskStateError reason; fallback identical.
 RR10 Two partitions: recovered independently; lastTs is the max.
 RR11 After recovery, a RiskStage built with the recovered cores and restored stamper continues: new commands get seq lastSeq + 1 and ts >= recovered lastTs even with a clock stepping back (stage option `recovered` comes in Prompt 4; test the stamper restore here).
 RR12 A 5,000-command tail with chunkSize 500: reads of at most 500 rows (query spy); result correct.
 Also: recovery performs no clock read (Date.now replaced by a throwing function still recovers).

STEP 5: Verify
build, lint, check:boundaries, npm test, npm run test:integration, npm run test:flake (unit and integration): 20/20. Report every ID with numRuns and seeds. Confirm engine-core and shard have no diff and Week 5 snapshot tests pass unmodified. Do not commit; tell me it is ready. THIS IS SPLIT POINT 1.
````

---

## Prompt 3: Durable ledger, order owners, durable reconciliation, ledger catch-up

````text
[PASTE THE SHARED PREAMBLE HERE]

PRECONDITION: Prompts 1 and 2 committed by me and green. Risk is durable on its own.

TASK: Persist the ledger, add the order-owners store, persist reconciliation with optimistic transitions, and build the ledger catch-up. Tests first.

STEP 1: Journal lookups used by catch-up (packages/journal and risk persistence; agent-written)
- PgJournal: `readEventsByType(symbol: string, types: readonly string[], afterSeq: number, chunkSize?: number): AsyncGenerator<readonly { seq: number; ts: number; event: EngineEvent }[]>` (keyset pagination, strict decode, uses the (stream_id, type, seq) index); `hasCommandForOrder(symbol: string, orderId: string): Promise<boolean>`; `readEventsForOrder(symbol: string, orderId: string): Promise<readonly { seq: number; ts: number; event: EngineEvent }[]>` (events whose orderId, takerOrderId or makerOrderId equals the id, ordered by seq, using the expression indexes).
- PgRiskJournal: `readEventsByType(partition, types, afterSeq, chunkSize?)` for FundsDeposited and AccountAdjusted.
Tests (integration, added to the journal and risk persistence test files): the lookups return the right rows in order across chunk boundaries; the order-id lookups return events for taker and maker participants; hasCommandForOrder true/false; none returns rows from another symbol or partition.

STEP 2: Order owners store (packages/risk/src/persistence/order-owners.ts)
`PgOrderOwners { constructor(db: SqlExecutor); insert(owner): Promise<void> /* idempotent */; get(orderId): Promise<OrderOwner | undefined>; getMany(orderIds: readonly string[]): Promise<ReadonlyMap<string, OrderOwner>> /* ONE query with = ANY($1) */ }`. (PgRiskJournal.appendEvents already inserts owners; this class is the reader and a standalone writer for tests.)
Tests OW1 to OW4 (integration): insert and lookup; idempotent re-insert leaves one row; a conflicting owner (different account, symbol or side) throws OrderOwnerConflictError; getMany of 500 ids issues one query (spy) and returns the right map (missing ids absent).

STEP 3: Ledger persistence (packages/ledger/src: the pure Ledger stays in its pure files; the adapter goes in pg-ledger-store.ts OUTSIDE any pure-zone path: check eslint.config.js: if the pure-zone block covers all of packages/ledger/src/**, narrow it to the pure files by moving the adapter into packages/ledger/src/persistence/ and excluding that folder from the block, and prove with a lint probe that the pure files are still covered and the adapter is not)
- Pure additions to Ledger: `static restore(entries: readonly LedgerEntry[]): Ledger` (rebuild from entries in order, renumber seq 1..n, throw LedgerCorruptError if checkInvariants() is not empty or a tx is unbalanced or duplicated legs exist) and `entriesOf(txId)`.
- `PgLedgerStore { constructor(db: SqlExecutor); appendTx(tx: LedgerTx, refEventId: string): Promise<{ posted: boolean }>; loadAll(): Promise<readonly LedgerEntry[]> /* ORDER BY seq, chunked */; invariantSums(): Promise<ReadonlyMap<string, bigint>> /* SELECT asset, SUM(amount) GROUP BY asset */ }`. appendTx: the caller (a persistence-aware wrapper `DurableLedger`) first validates balance with the pure Ledger; the store inserts all legs in ONE statement with `ON CONFLICT (tx_id, leg_idx) DO NOTHING`; if zero rows were inserted and the tx already exists return posted false; if only SOME legs conflicted (partial pre-existing tx) throw LedgerCorruptError. `DurableLedger` wraps the pure Ledger and the store: `post*` validates in memory, writes to the store, then applies to memory only after the store succeeded (so memory never gets ahead of the database), idempotent by txId; all of post, postDeposit, postTrade, postAdjustment, reverse.
Tests (integration for the store and DurableLedger; unit for restore):
 LP1 appendTx is atomic: a tx with 4 legs where the 4th violates a SQL constraint (e.g. zero amount via a raw bypass in the test) leaves NO rows.
 LP2 Duplicate txId: posted false, no new rows.
 LP3 An unbalanced tx is rejected by the pure Ledger BEFORE any SQL (query spy shows no INSERT).
 LP4 loadAll then Ledger.restore reproduces balances and invariants; entries in order; restore of a corrupted set (delete one leg via SQL) throws LedgerCorruptError.
 LP5 Reversal persisted as new rows `rev:<txId>`; originals untouched; reversing twice is a no-op.
 LP6 50 concurrent appendTx of the same tx: one set of rows, 49 posted false.
 LP7 Amounts near 2^63 - 1 and -(2^63 - 1) exact.
 LP8 SQL constraints: amount 0 rejected; DEBIT with a positive amount rejected; CREDIT with a negative amount rejected (raw SQL).
 LP9 invariantSums is 0n for every asset after a scripted run of deposits, trades, an adjustment and a reversal.

STEP 4: Ledger catch-up (packages/ledger/src/persistence/catch-up.ts; no clock)
`catchUpLedger({ engineJournal: PgJournal; symbols: readonly string[]; riskJournal: PgRiskJournal; partitions: number; owners: PgOrderOwners; ledger: DurableLedger; chunkSize?: number }): Promise<{ deposits: number; adjustments: number; trades: number; posted: number }>`: (1) for each partition stream FundsDeposited and AccountAdjusted events in seq order and call postDeposit / postAdjustment (idempotent by `dep:<requestId>` and `adj:<adjustmentId>`); (2) for each symbol stream TradeExecuted events in seq order, collect taker and maker order ids per chunk, `owners.getMany` them, derive buyer and seller from takerSide (BUY taker => taker is the buyer), and call postTrade (idempotent by `trade:<tradeId>`); a trade with a missing owner => throw OwnerMissingError (FATAL; name the tradeId and orderId). Sequential everywhere, no Promise.all.
Tests (integration; helpers seed a risk journal and engine journal with deposits, trades and adjustments through the real engine and core):
 LC1 Catch-up into an empty ledger reproduces the ledger a live run produced (balances and entries by txId).
 LC2 Partial ledger (delete some rows via SQL): catch-up fills the gap; final equals LC1.
 LC3 Idempotent: a second run posts nothing (posted 0) and leaves the entries unchanged.
 LC4 Missing owner row for a trade: OwnerMissingError; nothing else posted after the failure point is relied upon (assert the error and that the ledger invariants still hold).
 LC5 Week 8 Scenario 4: deposit 1,000, one trade, ledger initially has only the deposit: catch-up posts the trade with the right buyer and seller; balances equal the risk balances.
 LC6 After catch-up, for every account and asset the ledger balance equals the corresponding risk core balance (cash and positions): P19 holds.

STEP 5: Durable reconciliation store (packages/recon/src/persistence/pg-recon-store.ts, outside recon/src/core)
Read the existing ReconStore port and InMemoryReconStore from Week 7 and implement the SAME port with Postgres (if the port is not yet an interface, extract it WITHOUT changing the in-memory behavior; all Week 7 recon tests pass unmodified). Behavior per docs/WEEK-8.md 4.7: createRun is idempotent by file_hash (unique): a re-upload returns the existing run and inserts no breaks; run and breaks are inserted in ONE transaction; counts and parse errors stored as jsonb via canonical serialization (bigint as strings; read back equal); a status change runs in ONE transaction: `UPDATE recon_breaks SET status = $to, reason = $reason, resolved_by = $actor, updated_at = now() WHERE break_id = $id AND status = $from RETURNING ...` (zero rows => throw ReconError('CONCURRENT_MODIFICATION')) plus the recon_audit insert in the same transaction; terminal states can never be left (the WHERE enforces it); the audit table has no update or delete path in the store API; filters by run, type, status; age computed from an injected `now`.
Tests (integration), run through the same workflow-level assertions as the in-memory store where possible:
 RDB1 A run uploaded, the store re-created (new instance, same database), the same file hash uploaded again: same run id, no new breaks.
 RDB2 Breaks and counts persisted and read back deep-equal (bigint values exact).
 RDB3 An allowed transition writes the break update and one audit row in one transaction (assert atomicity by forcing the audit insert to fail and checking the status did not change).
 RDB4 Week 8 Scenario 5: two concurrent resolves of the same OPEN break: exactly one succeeds, the other fails CONCURRENT_MODIFICATION, exactly one audit row exists for that change.
 RDB5 Terminal immutability under concurrency: a RESOLVED break cannot be moved by a concurrent writer.
 RDB6 Empty or whitespace reason, or a missing actor, is rejected by the workflow AND by the database constraint (raw SQL insert attempt).
 RDB7 Audit rows ascending by seq, fields complete, append-only API.
 RDB8 Filters by run, type and status return the right sets.

STEP 6: Verify
build, lint (prove the pure-zone coverage of ledger pure files and recon core still holds), check:boundaries (risk, ledger, recon import no `pg`), npm test, npm run test:integration, npm run test:flake (unit and integration): 20/20. Confirm engine-core and shard have no diff; Week 6 and 7 ledger and recon tests pass unmodified. Report LP1 to LP9, OW1 to OW4, LC1 to LC6, RDB1 to RDB8 and the journal lookup tests. Do not commit; tell me it is ready.
````

---

## Prompt 4: `runtime`, `recoverPipeline`, crash-point tests, end-to-end properties

````text
[PASTE THE SHARED PREAMBLE HERE]

PRECONDITION: Prompts 1 to 3 committed by me and green. This prompt is large; it has stopping points marked STOP-A, STOP-B (I will commit between them).

TASK: Build the runtime composition root and recoverPipeline, then prove recovery across both stages with crash-point tests and end-to-end properties.

STEP 1: Recovery support code (agent-written; tests first)
- PgJournal: nothing more (Prompt 3 added the lookups). PgRiskJournal: `hasSubmit(partition: number, orderId: string): Promise<boolean>` (a SubmitOrder COMMAND row for that order id exists; uses the command expression index).
- EngineEventRouter (packages/risk/src/router.ts): `restoreOwners(owners: Iterable<[orderId: string, owner: OrderOwner]>): void`; `setWatermark(symbol: string, lastSeq: number): void` (so the next live output must be lastSeq + 1; with SeqDeduper from common if the router uses it); `onShardOutputs(outputs, opts?: { catchUp?: boolean })`: in catch-up mode it SKIPS sequence dedupe and gap detection (the outputs are a filtered subset) but otherwise maps events exactly as in live mode; it must not advance the watermark.
- MarketView: `static fromBook(symbol: string, book: { restingOrders(): readonly { orderId: string; side: 'BUY' | 'SELL'; price: bigint; remaining: bigint }[] }, lastTrade?: { price: bigint; ts: number }): MarketView` (or an instance method `loadFromBook`): applies synthetic OrderRested events in book (price-time) order and sets lastTrade.
- RiskStage: option `recovered?: { partitions: ReadonlyMap<number, { core: RiskCore; lastSeq: number }>; lastTs: number }` (cores supplied instead of fresh ones; stamper restored per partition with seq and lastTs) — the stage already has afterBatch from Prompt 2.
Tests (unit, first):
 RM1 router.restoreOwners then a live ShardOutput for a restored order maps to the right notices; a restored owner map equals one built live through registerOrder.
 RM2 MarketView.fromBook: for random books produced by the real engine (property, numRuns >= 300), snapshotFor equals the live MarketView fed the same events (best bid, best ask, last trade).
 RM3 Catch-up mode: a gapped subset of outputs (seq 3, 7, 12) is accepted with no SeqGapError and no dedupe skip; after setWatermark(symbol, 12) a live output seq 13 is accepted, seq 12 is a duplicate, seq 15 is a gap error.
 RM4 Notice catch-up on a core: build a live core and router for Scenario 3 (BUY q10 @105 resting, counterparty fills 4 @ 101); simulate "risk missed the fill" by NOT delivering the TradeExecuted notices; run the catch-up (router catch-up mode over the engine events of the live order) and assert the core converges to cash 10_000 - 404, held 630, position 4; a second catch-up changes nothing (idempotent).
 RS1 RiskStage `recovered` option: the stamper continues from the recovered seq and lastTs (clock stepping back clamped); the supplied cores are the ones that apply.

STEP 2: runtime package (packages/runtime)
- Move the wiring from packages/system-tests/src/wire.ts to packages/runtime/src/wire.ts WITHOUT changing behavior, and make system-tests import it (a thin re-export is fine). ALL Week 6 and 7 system tests pass UNMODIFIED.
- `createRuntime(opts)`: opts include `mode: 'memory' | 'postgres'`, symbols (engine InstrumentSpec map plus risk config and optional breaker configs), partitions, clock, queue capacities, snapshot intervals, `db?: SqlExecutor`. In `postgres` mode: engine PgJournal + DurableEventSink, ShardRunner with SnapshotScheduler as afterBatch (Week 5), RiskStage with PgRiskJournal per partition + DurableRiskOutbox + RiskSnapshotScheduler, DurableLedger over PgLedgerStore, PgOrderOwners, the router with MarketView, the TickInjector, the LeakSweeper. In `memory` mode: the Week 6/7 in-memory behavior. The outbox and sink wiring rules from Week 6 stay (register owner before enqueue; ledger posts for deposits, adjustments and trades; notices on the unbounded path), now awaiting durable ledger posts. Expose a `Runtime` facade: submitOrder, deposit, openAccount, cancel (by router owner map), adjust, probe, halt/resume, quiesce(), view(accountId), stop().
- `recoverPipeline(opts)` implementing docs/WEEK-8.md 4.5 EXACTLY, in order, with these steps and failure policy:
  1. recoverShard (Week 5) for all symbols with breaker configs threaded through; republish regenerated engine events needs nothing here (catch-up covers them).
  2. recoverRiskStage (Prompt 2) for all partitions.
  3. Rebuild router owners: for every reservation in every recovered core, owner from `owners.getMany` (live orders); create MarketView.fromBook per symbol from the recovered book and the last TradeExecuted (readEventsByType); router.setWatermark(symbol, engine lastSeq).
  4. Notice catch-up: for every live reservation (any state), `engineJournal.readEventsForOrder(symbol, orderId)`, build ShardOutput-shaped objects (symbol, seq, ts, events [event]) in seq order, route with { catchUp: true }, and deliver the notices to the recovered stage (queued on its notice path before start).
  5. Redelivery: for every reservation in state PENDING_ACK: `engineJournal.hasCommandForOrder(symbol, orderId)`; if false, `riskJournal.findOrderAccepted(partition, orderId)`, then enqueue `acceptedToPlaceOrder(event)` to the recovered shard (retry on FULL with yields); if true, do nothing (step 4 handled its events).
  6. Ledger: `Ledger.restore(loadAll())` into a DurableLedger, then catchUpLedger.
  7. Start the ShardRunner (recovered), RiskStage (recovered), TickInjector, sweeper; return the running Runtime.
  Fatal (throw, start nothing): ReplayMismatchError, JournalGapError, InvalidRiskStateError, OwnerMissingError, LedgerCorruptError, a PENDING_ACK order with no OrderAccepted event in the risk journal, a database error. Return a `RecoveryReport` with per-step counts (replayed, verified, regenerated, redelivered, catchUpNotices, ledgerPosted).
Tests (integration; build helpers that seed a Postgres pipeline through a real Runtime in postgres mode, stop it hard, and recover):
 PR1 Redelivery decision: PENDING_ACK + no engine command => redelivered; engine command present => not redelivered (assert via the engine journal's PlaceOrder count for the order id).
 PR2 Week 8 Scenario 2: order accepted and journaled in risk, never reached the shard: after recovery it rests exactly once (engine journal has exactly one PlaceOrder for it); reservation intact; a second recovery does not redeliver.
 PR3 An IOC that already completed in the engine but whose events risk did not see: NOT redelivered (the engine journal has the command), and catch-up closes the reservation correctly.
 PR4 Ordering: record the order of the seven steps (instrument the steps) and assert it; an injected fatal error in step 2 starts nothing (no runner, no stage, no ticks) and no step after it ran.
 PR5 Each fatal condition (tampered stored event, deleted command row, invalid snapshot state with no fallback possible, missing owner row for a live order, a PENDING_ACK order whose OrderAccepted is missing) makes recoverPipeline reject with the matching error and start nothing.
 PR6 A recovered runtime accepts new orders: seq and ts continue; reservations consistent; ledger equals risk; invariants hold.
STOP-A: print "STOP-A: runtime and recoverPipeline built; tests PR1 to PR6, RM1 to RM4, RS1 status", do NOT commit, and wait for me to say CONTINUE.

STEP 3 (after CONTINUE): crash controller, crash-point tests, end-to-end properties
- packages/system-tests/test/helpers/crash.ts: `class SimulatedCrash extends Error`; `class CrashController { crashed: boolean; trip(): void; arm(plan): void }` where a plan is `{ kind: <durable I/O kind>, nth: number, when: 'before' | 'after' }`; kinds: 'engine.journal.append', 'engine.events.append', 'engine.snapshot.save', 'risk.journal.append', 'risk.events.append' (includes the owner rows), 'risk.snapshot.save', 'ledger.append', 'shard.enqueue' (the risk outbox handing an OrderAccepted to the shard), 'stage.notify'. Wrapper classes around every durable collaborator (PgJournal, DurableEventSink path, PgRiskJournal, DurableRiskOutbox, snapshot stores, DurableLedger, the shard enqueue function in the wiring) count calls by kind; when the armed plan matches, they trip the controller (before or after the real call); ONCE tripped, EVERY subsequent durable call of every wrapper rejects with SimulatedCrash (so nothing else becomes durable even if background loops keep running; in-memory work is effectively lost). The test then waits until both runners/stages are FAILED or stopped, discards all in-memory objects (runtime, journals, pools if feasible; reuse the database) and calls recoverPipeline on a fresh Runtime from Postgres.
- Crash-point tests RCP1 to RCP7 (docs/WEEK-8.md 4.4), each with a fixed deterministic plan, sequential flow, constant fake clock, one partition, symbols ACME and BETA with funded accounts (a few deposits, GTC and IOC orders, a market order, a cancel, a halt-free flow):
 RCP1 trip 'after' risk.journal.append before apply; RCP2 trip during risk apply (a wrapper around the core's apply that trips before it returns the events); RCP3 trip 'after' risk.events.append on a batch containing an OrderAccepted (so the shard never gets it); RCP4 trip 'after' shard.enqueue and before the shard journal (engine.journal.append 'before'); RCP5 trip 'after' engine.events.append / before notices reach risk (stage.notify 'before'); RCP6 trip 'before' ledger.append for a deposit and for a trade; RCP7 trip during risk.snapshot.save with the newest snapshot torn (insert a bad-checksum row at the journal's last seq, as in Week 5 R1 CP4).
 For each: resend ONLY submissions whose SubmitOrder is not in the risk journal (`hasSubmit` false), run the rest of the flow, quiesce, and assert the final state EQUALS an uninterrupted run of the same flow on a fresh schema: engine books (snapshot), per-partition risk exportState, ledger entries by txId (balances), the engine EVENT rows in seq order, and the order_owners set. Also a RCP-dup test: resend ALL submissions after a crash (including durable ones): the durable ones produce DuplicateIgnored and no state change (final state still equals the uninterrupted run).
- P25 (fast-check, numRuns about 40): SEQUENTIAL flows (one command at a time, quiesce between commands), 1 partition, a random flow of 20 to 60 actions (deposits, LIMIT GTC/IOC and MARKET orders with market inputs, cancels of known orders, probes), a random crash plan over all kinds, nth and when; crash, recover, resend non-durable submissions, finish; assert equality with the uninterrupted run as above. Print the seed and the crash plan on failure.
- P26 (fast-check, numRuns about 40): CONCURRENT flows (3 to 6 accounts, 2 to 3 symbols, partitions 1 and 4, random delay schedules at journal awaits, submissions issued without quiescing in between) with a random crash plan; after recovery and completion assert: every Week 6/7 invariant holds (risk checkInvariants, ledger invariants, positions zero-sum, total cash zero-sum including @EXTERNAL and @SUSPENSE); ledger equals risk (P19x); EVERY submitted order has exactly one terminal fate (filled, cancelled, rejected by risk, rejected by matcher, released, or still resting with a live reservation) with no order missing and none duplicated in the engine journal (at most ONE PlaceOrder per order id); no reservation exists without a live (resting) or PENDING_ACK-with-no-command order (after recovery completes redelivery there must be none PENDING_ACK older than the sweep window once the sweeper runs a probe).
- P19x: P19 reconciliation asserted after every recovery in P25 and P26 (already part of their assertions; report it separately).
STOP-B: print "STOP-B: crash-point tests and properties done", do NOT commit.

STEP 4: Verify
build, lint, check:boundaries, npm test, npm run test:integration, npm run test:flake (unit and integration): 20/20. Confirm engine-core and shard have no diff; every Week 5, 6 and 7 test passes UNMODIFIED, including C2. Report RM1 to RM4, RS1, PR1 to PR6, RCP1 to RCP7, RCP-dup, P25, P26, P19x with numRuns and seeds; run P25 and P26 with three different seeds. Do not commit; tell me it is ready. THIS IS SPLIT POINT 2.
````

---

## Prompt 5: `SIGKILL` pipeline chaos, mutations, docs, final gate

````text
[PASTE THE SHARED PREAMBLE HERE]

PRECONDITION: Prompts 1 to 4 committed by me; all unit and integration tests green; flake gate 20/20.

TASK: (1) the real-process SIGKILL chaos script across the whole pipeline (R1c), (2) mutation checks (no git), (3) documentation, (4) the final verification gate.

STEP 1: Pipeline chaos (R1c)
- packages/runtime/src/chaos-child.ts (compiled by the repo build): args `--database-url --schema --seed --total N --snapshot-every K`. It connects (pool with search_path set to the schema), runs recoverPipeline (printing one JSON line `{"phase":"recovered","report":{...},"recoveryMs":...}`), then feeds a deterministic SEQUENTIAL flow from `mulberry32(seed + i)` for i = resume index .. N-1 (single partition, symbols ACME and BETA, funded accounts created and deposited on the first run only via idempotent requestIds, then LIMIT GTC/IOC and MARKET orders with unique ids `o<i>`, cancels of earlier ids, price band 95..105, qty 1..20), waiting for quiesce after every command; constant fake clock. The resume index is derived from the DATABASE: the number of distinct flow actions already durable (count risk-journal SubmitOrder, Deposit, cancel markers by their action index; store the action index in the command's orderId or requestId, e.g. `o<i>` / `dep<i>`, and compute resume = 1 + max index found, then resend only what is not durable). Prints `{"phase":"done"}` and exits 0 at the end.
- scripts/chaos-pipeline.mjs (plain Node, cross-platform, child_process.spawn, imports compiled dist): creates a unique schema, runs migrations; loops: spawn the child; wait a delay from a seeded PRNG between 40 and 900 ms (real waiting is allowed in THIS script); `child.kill('SIGKILL')`; if the child printed done first, stop; else restart. Options `--kills 15 --total 600 --snapshot-every 50 --seed 1`. At the end run an UNINTERRUPTED reference of the same flow in the script process (fresh schema, no kills) and compare: engine EVENT rows in seq order, risk exportState, ledger balances and entries by txId, books, order_owners. Print a report (kills, restarts, per-restart recoveryMs, report counts: replayed, regenerated, redelivered, catch-up notices, ledger posted) and PASS or FAIL with the first difference; exit code 0 or 1. A child that exits on its own with an error (not SIGKILL) => print its stderr and FAIL.
- `npm run chaos:pipeline` in the root package.json. NOT part of `npm test` or `npm run test:integration`; optional CI job (workflow_dispatch or nightly) with `--kills 8`.
- Run it with seeds 1, 2, 3 and report kills, restarts, PASS/FAIL and the recovery times. If a run FAILS, do not hide it: report the first difference and stop; I decide.
When Step 1 is green, print "STEP 1 DONE: please commit the chaos script yourself, then say CONTINUE" and STOP. Do not start Step 2 until I say CONTINUE.

STEP 2: Mutation checks (no git operations)
For EACH mutation: (a) copy every file you are about to change to the OS temp directory and record its SHA-256; (b) apply the mutation by editing the file; (c) run the narrowest relevant unit and integration tests (and P25/P26 or RCP where relevant) and record which fail; (d) restore the file BYTE FOR BYTE from the temp copy and verify the SHA-256 matches. Never use git to undo a mutation (no checkout, restore, reset, stash or clean: they could destroy my uncommitted work). Before starting run `git status --short` and `git diff --stat` and save the output; after the last mutation confirm both are IDENTICAL. Mutations:
 M1 recoverRiskPartition skips one command => RR2, RR3, P25.
 M2 RiskCore.restore forgets decidedOrders => RX5, P24.
 M3 restore forgets haltedSymbols => RX5.
 M4 restore forgets appliedTradeIds => RX5, RM4.
 M5 DurableRiskOutbox forwards before journaling events => DO1.
 M6 owner row not inserted in the same transaction as the events => DO2.
 M7 redelivery ignores the engine-journal check (places twice) => PR1, PR3, P26.
 M8 redelivery skipped (order lost) => PR2, RCP3, P25.
 M9 notice catch-up skipped => RM4, RCP5, P26.
 M10 ledger catch-up not idempotent (no ON CONFLICT / no txId check) => LC3.
 M11 ledger append not atomic (row by row) => LP1.
 M12 recon transition without the optimistic `WHERE status = $from` => RDB4, RDB5.
 M13 risk codec drops MarketInput => RCD4, RR2.
 M14 risk snapshot taken before the last command of the batch is applied => P24, RR3.
 M15 RiskStamper.restore forgets lastTs => RR11, RS1.
 M16 recoverPipeline runs ledger catch-up before shard and risk recovery => PR4, LC.
 M17 router catch-up applies sequence-gap detection => RM3.
 M18 Ledger.restore skips the invariant check => LP4.
Report a table: mutation | tests that failed | SURVIVED if none. A survivor is a test gap: strengthen or add the test (as a normal edit after all mutations are restored), re-run, report. Confirm the before/after `git status --short` and `git diff --stat` outputs are identical apart from the new test edits you list.

STEP 3: Documentation
1. docs/decisions.md: entries (context, options, choice, trade-offs, how tested) for docs/WEEK-8.md section 10 items 1 to 14.
2. docs/BLUEPRINT.md: add the new test IDs to the right tables (RCD1 to RCD7, MG4, RJ1 to RJ8, DO1 to DO3, RX1 to RX7, P24, RSS1 to RSS5, RSC1, RR1 to RR12, LP1 to LP9, OW1 to OW4, LC1 to LC6, RDB1 to RDB8, RM1 to RM4, RS1, PR1 to PR6, RCP1 to RCP7, P25, P26, P19x, R1c); update 5.5 data model with order_owners, ledger_entries, recon_runs, recon_breaks, recon_audit and the risk streams in the journal table; update the dependency map and the workspace count (thirteen).
3. docs/WEEK-8.md: update every detail that deviated in reality (names, signatures, indexes, counts) so doc and code agree.
4. docs/architecture.md: add the risk crash-window table (RCP1 to RCP7), the `recoverPipeline` sequence diagram, and the redelivery-by-engine-journal rule.
5. README limitations section (rewrite honestly): crash recovery now spans the matching engine, risk stage, ledger and reconciliation store, proven by crash-point tests and a real SIGKILL script; still NOT covered: fencing against zombie writers (writer_epoch is recorded, enforcement comes with Kafka in Week 10), unbounded growth of dedupe sets, recovery time growing with the log tail, single-instance only.
6. PROGRESS.md: a Week 8 section with one row per prompt, the mutation table, flaky-test root causes, seeds of property failures, deviations, and "Next: Week 9 (API, WebSocket, projections; runtime facade)".

STEP 4: Week 8 verification gate (run all, report each)
1. `npm ci`, then `npm run build && npm run lint && npm run check:boundaries && npm test && npm run test:integration`.
2. `npm run test:flake` (unit and integration): 20/20 each.
3. Lint and boundary proofs again: Date.now in risk/src/core fails; `pg` import in packages/risk fails check:boundaries; engine-core diff empty (`git diff --stat -- packages/engine-core` and against the Week 7 boundary commit).
4. Greps: no `Promise.all|forEach(async` in journal, risk, ledger, recon, runtime source; `pg` imported only in packages/journal; no `setTypeParser` outside the pool-scoped option; no `JSON.stringify(` over command/event/state objects (only codecs and canonicalJson); no `node:` in packages/common/src.
5. Test inventory with pass state for every ID in docs/WEEK-8.md section 8, plus the earlier families (C2 still passing). Anything missing or skipped is named.
6. `npm run chaos:pipeline` PASS for seeds 1, 2, 3 (paste the report lines).
7. Do not commit or push. Tell me everything is ready; I will commit, push and check CI myself.

Final report: the shared REPORT FORMAT plus "Week 8 definition of done: met / not met, and why", the mutation table, the chaos results, and one paragraph answering: "After killing the process at any point, does the system lose or duplicate an order, strand a reservation, or let ledger and risk disagree? Evidence: RCP1 to RCP7, P25, P26, R1c."
````

---

## What to do between prompts

- **After Prompt 1:** read the three boundary proofs. `pg` living only in `journal` is what keeps the other packages testable without a database.
- **After Prompt 2 (before you write `restore()`):** read RX1 to RX7 top to bottom. They are your specification. Write validate first, build second, check invariants third, return last. Draw the risk state on paper and tick each field you restore.
- **After Prompt 3:** you have a durable ledger and reconciliation store. This is a good place to rest.
- **After Prompt 4:** read RCP1 to RCP7 and draw the two crash tables (engine CP1 to CP5, risk RCP1 to RCP7) on one timeline of a single order. Say aloud why redelivery checks the engine journal.
- **After Prompt 5:** read the mutation table. A surviving mutation means a weak test; make the agent strengthen it. Re-read the README limitations section: it must say what the recovery claim covers and what it does not.

---

## Your commits (run these yourself; the agent never commits)

Run from the repo root after the prompt is green. `git status --short` first to confirm only the files you expect changed.

| After | Commit message |
|-------|----------------|
| Prompt 1 | `week8: runtime skeleton, SqlExecutor, migrations 004-007, risk codecs, PgRiskJournal and outbox` |
| Prompt 2, checkpoint (restore stub, tests failing) | `week8: risk state export and failing restore tests` |
| Prompt 2, after your REVIEW is green | `week8: RiskCore restore` |
| Prompt 2, after Step 4 (snapshots and recovery) | `week8: risk snapshots and recoverRiskPartition` |
| Prompt 3 | `week8: durable ledger, order owners, durable reconciliation, ledger catch-up` |
| Prompt 4, STOP-A | `week8: runtime package and recoverPipeline` |
| Prompt 4, STOP-B | `week8: crash-point tests and end-to-end recovery properties` |
| Prompt 5, after Step 1 (chaos script) | `week8: SIGKILL pipeline chaos script` |
| Prompt 5, at the end | `week8: mutation checks, docs and verification gate` |

```bash
git status --short
git add -A
git commit -m "week8: ..."      # paste the message from the table
git log -1 --format='%an <%ae> | committer %cn <%ce>'   # confirm it is you
```

If a commit ever shows Copilot as author or co-author, check `git log -1 --format=%B` for a `Co-authored-by` trailer and confirm `git config user.name` and `user.email` are yours. The prompts forbid the agent from running any commit or staging command and from adding trailers.