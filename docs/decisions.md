# Architecture Decisions

## Week 8 Decisions

1. **Durability before API**
   - Deliver recovery proof (Week 8) before exposing "durably received" claim (Week 9)
   - Guarantees API honesty and forces critical path testing first
   - Tradeoff: delays external-facing features by one week

2. **Reuse journal + snapshots tables for risk partitions**
   - Risk commands/events in same `journal` table with `stream_id='risk-<partition>'`
   - Risk state in same `snapshots` table with risk state codec
   - Rationale: single journal abstraction, consistent snapshot storage, simpler recovery orchestration
   - Tradeoff: requires careful `stream_id` routing; no per-partition table optimization

3. **exportState() separate from snapshot()**
   - `exportState()` returns full state (with dedupe sets, halted symbols, applied trade ids)
   - `snapshot()` returns set sizes (unchanged, for cheap comparisons)
   - Rationale: validation and restore need full state; compact representation still available for checks
   - Tested by RX1-RX2 (isolation, canonical form)

4. **RiskCore.restore validates first, builds second, checks invariants last**
   - All validation before any mutation: version, config, no duplicate orders, account existence, amount consistency, held ≤ owned, positivity, reservation in decidedOrders
   - If any check fails, throw InvalidRiskStateError before building anything (all-or-nothing)
   - Then run checkInvariants() after build
   - Mirrors OrderBook.restore; prevents silently corrupted state becoming live
   - Tested by RX6-RX7 (malformed rejection, invariant gate)

5. **Events journaled before forwarding; order_owners in same transaction**
   - DurableRiskOutbox appends events to journal first, then forwards to shard
   - OrderAccepted event + order_owners row inserted in single SQL transaction
   - Rationale: if either fails, neither persists; if forward fails after append, redelivery will catch it
   - Tested by DO1-DO2 (ordering, atomicity)

6. **Redelivery decided by engine journal, not sweeper alone**
   - Order is PENDING_ACK AND engine journal has no PlaceOrder → redeliver exactly once
   - Rationale: engine journal is durable truth; sweeper is volatile (runs periodic, may miss stale orders)
   - Prevents double placement of IOCs that already completed; prevents lost orders that never reached shard
   - Tested by PR1-PR3 (redelivery decision logic)

7. **Notice catch-up by order id with indexed lookups, idempotent core handlers**
   - After shard recovery, for each live order in risk, read engine events mentioning it and reroute via router catch-up mode
   - Catch-up mode skips sequence-gap detection (intentional gaps from other partitions)
   - Router then sets watermark to engine's last seq
   - Idempotent handlers (appliedTradeIds dedup, unknown-order ignore) prevent duplicates
   - Tradeoff: O(live_orders × event_lookups); simpler than router checkpoint state
   - Tested by RM3-RM4 (gap skip, watermark set, idempotency)

8. **Ledger durability: entries table + idempotent catch-up, not derived-only**
   - Entries table persists every posting atomically (UNNEST + ON CONFLICT DO NOTHING)
   - Live posts append; catch-up replays deposits, adjustments, trades from journals
   - Second run of catch-up posts nothing (dedup by txId, leg_idx)
   - Rationale: persistent audit trail; catch-up fills gaps without full replay; entries verify balance invariants
   - Tradeoff: entries table separate from risk journal (different seq counters)
   - Tested by LP1-LP9, LC1-LC6 (atomicity, catch-up, invariants)

9. **Recon store with optimistic transitions + database constraints**
   - Status change: UPDATE ... WHERE break_id AND status=FROM (optimistic check)
   - Zero rows means concurrent modification (fail with CONCURRENT_MODIFICATION error, not silent)
   - Audit row inserted in same transaction
   - Terminal states enforced by same WHERE (cannot transition FROM RESOLVED or WRITTEN_OFF)
   - Database constraints also reject empty reason or actor
   - Rationale: no pessimistic locks; audit trail is append-only
   - Tested by RDB3-RDB5 (transactions, immutability)

10. **SqlExecutor abstraction: journal owns Postgres, others use type only**
    - journal/ imports `pg`, exports SqlExecutor interface (`query`, `transaction`)
    - risk/, ledger/, recon/ depend on journal for SqlExecutor type, never import `pg`
    - Rationale: single Postgres dependency point; easier to swap driver or mock for testing
    - Enforced by check-boundaries.mjs
    - Tested by indirection (all persistence tests use executor, not pg directly)

11. **New runtime workspace as composition root**
    - recoverPipeline, wire, recovered state wiring moved from system-tests to runtime
    - system-tests imports runtime, not the reverse
    - Rationale: single entry point for all production wiring; API (Week 9) will also depend on runtime
    - Tradeoff: extra workspace, but pays off in Week 9
    - Tested by PR4-PR6 (pipeline ordering, new orders accepted)

12. **Fatal vs recoverable conditions during recoverPipeline**
    - Fatal (throw, nothing starts): ReplayMismatchError, JournalGapError, InvalidRiskStateError, OwnerMissingError, ledger invariant failure
    - Recoverable (logged, continue): missing snapshot, torn snapshot, snapshot ahead of journal, snapshot restore fails (fall back to replay)
    - Rationale: journaling errors and state corruption cannot be recovered; storage errors are expected transient
    - Tested by PR5 (fatal conditions block start)

13. **Known limits: unbounded dedupe, no fencing, growing tail**
    - Dedupe sets (decidedOrders, seenRequestIds, seenAdjustmentIds, appliedTradeIds, haltedSymbols) grow without bound
    - writer_epoch recorded but not enforced (no multi-instance failover yet)
    - Recovery time grows with tail length (no compaction, no indexing on entry age)
    - Rationale: Week 8 focuses on single-partition proof; Week 10 adds bounding, fencing; Week 9 API doesn't need multi-instance yet
    - Documented in README

14. **Recovery claim scope: what's proven and what's not**
    - ✅ Proven: single-partition, single-instance, crash at any point between/within stages, sequential and concurrent flows, deterministic recovery
    - ❌ Not proven: multi-instance failover, fencing enforcement, property tests at full scale, performance under high tail length
    - Rationale: Week 8 delivers proof-of-concept; Week 9-10 extend claims
    - Tested by 122 tests, 40-200 property runs each
    - Documented in WEEK-8.md and README
