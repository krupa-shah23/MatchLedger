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

---

## Week 9 Decisions

1. **Fastify with Postgres projections as the read side, not in-memory or Redis**
   - HTTP requests read from projection tables (orders_view, balances_view, etc.) synced by a checkpointed projector
   - Projector replays journals exactly-once per stream using locked checkpoint comparison
   - Rationale: rebuildable from journals, provably consistent with risk core (P27), no eventual consistency surprises in the read path
   - Tradeoff: adds projector latency (typically <100ms, documented via /system/health lag metric); requires Postgres
   - Tested by P27, P28, PJ1-PJ12, OA14

2. **`202` means journaled to risk partition, nothing more**
   - POST /orders returns 202 only after `SubmitOrder` command is appended to risk journal
   - Risk failures (insufficient balance, symbol halted) arrive asynchronously as events (OrderRejected)
   - No synchronous 422; clients wait for WebSocket notification or poll GET /orders/{id}
   - Rationale: honest API claim; durability proof; mismatched with synchronous balance checks would be deceptive
   - Tradeoff: clients must handle async rejection lifecycle
   - Tested by OA8 (202 ordering), OA3 (async rejection), OA1 (flow to terminal state)

3. **Single-flight per (accountId, clientOrderId) deduplicates concurrent identical submissions**
   - In-process promise map stores pending work by key; concurrent identical calls await the same promise
   - Risk core's orderId dedupe is the cross-process, cross-restart safety net
   - On failure, the key is freed so a retry can execute independently
   - Rationale: one command journaled per user per key; stateless HTTP handlers; single-flight is a correctness optimization, not required for safety
   - Tradeoff: in-memory per API instance; distributed single-flight needs Redis
   - Tested by OA10 (exactly one journal row), OA10b (failed execution frees key), OA4 (idempotent retry)

4. **Facts, not statuses, in projection tables; `deriveOrderStatus()` pure and order-independent**
   - orders_view stores `accepted`, `rested`, `filledQty`, `terminal`, `cancelRequested` as journal facts
   - Status is derived at read time by a pure function: `REJECTED` > `FILLED` > `CANCELLED` > `CANCEL_REQUESTED` > `PARTIALLY_FILLED` > `RESTING` > `ACCEPTED` > `RECEIVED`
   - Precedence is total and independent of the order facts arrived (P28)
   - Rationale: status computable at read time is testable and order-independent; writes never need to recompute
   - Tradeoff: read-time overhead (negligible; one function call per order)
   - Tested by OS1-OS3 (truth table, permutation invariance, impossible facts throw)

5. **Exactly-once projector by locked checkpoint read before chunk, mutations and checkpoint advance in one transaction**
   - Projector transaction: BEGIN; SELECT FROM projection_checkpoints WHERE (projection, stream) FOR UPDATE; read chunk; apply mutations; UPDATE checkpoint; COMMIT
   - Concurrent projector instances serialize on the lock; the second re-reads from the new checkpoint
   - Incremental counters (cash -= cost) are safe because chunks never double-apply
   - Crash before COMMIT rolls back; checkpoint unchanged
   - Rationale: atomic all-or-nothing for counters; cross-instance safety without distributed locks
   - Tradeoff: checkpoint lock contention (unobserved in testing; projector is typically 1 instance)
   - Tested by PJ3 (fault before commit), PJ11 (two instances, singleton refuses second poller), PJ1-PJ6 (various scenarios)

6. **Reads are eventually consistent; `GET /orders/{id}` synthesized RECEIVED if no projection row**
   - Between `202` and first projector run, GET returns synthesized `{status: RECEIVED}` from order_requests table
   - Clients use WebSocket for live updates; GET is a safety net for missed messages
   - Rationale: projection lag is expected; client protocol accounts for it
   - Tradeoff: read-after-write consistency is eventual, not immediate
   - Tested by OA14 (synthesized RECEIVED before projection), WebSocket epoch/seq resync rules (WS4, P29)

7. **Cancel journaled by shard queue, not durable until checkpoint advances**
   - HTTP `DELETE /orders/{id}` calls `cancelOrder()` and returns `202` immediately
   - Command is enqueued to shard queue (in memory); if shard crashes, the cancel is lost
   - HTTP handler never writes `cancel_requested`; projector writes it when it reads the journaled `CancelOrder` command
   - Rationale: stateless API; consistent source of truth (journal); crash recovery retries
   - Tradeoff: small window of data loss (cancel is not durable until shard journals); documented
   - Tested by OA11b (status stays RESTING until shard journals), PJ12 (projector is the only writer)

8. **WebSocket epoch for client resync on process restart; book seq is engine seq**
   - epoch: random ID generated at process start; client resyncs REST snapshot on epoch change
   - book.{symbol}: seq is the engine's partition seq (monotonic but not contiguous; gaps are intentional)
   - user.*, breaker, risk.rejections, system: seq is a gateway counter (topic-local, not engine seq)
   - Rationale: books are order-sensitive (price levels); client needs authoritative seq to resync after gaps. Other topics are event streams (order not critical)
   - Tradeoff: two seq semantics (confusing); documented in protocol section 4.9
   - Tested by WS4 (seq present), P29 (model book reconstruction with deltas and conflation)

9. **Conflation for books, bounded queue for non-conflatable topics; slow client closes 1013 above HARD**
   - Book topics: above HIGH bufferedAmount, stop sending deltas; send fresh snapshot with `conflated: true` after drain below LOW
   - Non-conflatable (user.*, breaker, risk.rejections): queue up to 1,000; beyond that or above HARD, close 1013
   - Rationale: books are high-volume, stateless (snapshot beats deltas); user events are correctness-critical (must not lose)
   - Tradeoff: slow users get closed and must reconnect; documented in protocol
   - Tested by HB3 (conflated snapshot), HB2 (threshold behavior), HB5 (memory bounded)

10. **`404` for foreign resources, `403` for role mismatch**
    - Another trader's order, account, or resource: 404 (indistinguishable from unknown)
    - Wrong role (TRADER calling /risk/halt): 403
    - Rationale: privacy by design; prevents account enumeration
    - Tradeoff: client cannot distinguish "doesn't exist" from "you can't see it"
    - Tested by RBM (role matrix; every route × every role)

11. **JWT HS256 with auth_time + SESSION_MAX_SECONDS for session age limit**
    - Token claims: sub, role, iat, exp, jti, auth_time (time of original password login)
    - Refresh: issues new token with same auth_time, but refuses if (now - auth_time > SESSION_MAX_SECONDS)
    - No token revocation (deferred); expired tokens are the only way to invalidate
    - Rationale: simple; no revocation list; session age prevents indefinite access
    - Tradeoff: leaked token valid until exp; revocation needs a blacklist (Week 10+)
    - Tested by AU1-AU8 (login, refresh, session age)

12. **In-memory rate limiter and single-flight behind injectable ports; single API instance**
    - RateLimiter: token bucket per account; login has separate buckets per IP and username
    - Both are in-process; horizontal scaling requires moving to Redis
    - Rationale: simpler proof for single instance; clear upgrade path
    - Tradeoff: does not scale; documented limitation
    - Tested by RLM1-RLM3 (bucket behavior, limits, per-user isolation)

13. **Account projections must equal risk core (P27); realized P&L computed at projection time**
    - balances_view, positions_view, reservations_view are fed only from risk-stream events (single ordered source per account)
    - Realized P&L: on a SELL of f shares from position q with basis B: removed = (q == f) ? B : floor(B * f / q); realized += proceeds - removed
    - Property P27 proves equality by comparing random flows after quiescence
    - Rationale: shadow state is a correctness hazard; invariants prove it
    - Tradeoff: projector must correctly map every event; single source of truth is testable
    - Tested by P27 (property test), PX1-PX3 (P&L vectors and edge cases)

14. **Resume on automatic Open breaker returns `202` with visible `BreakerCommandIgnored` fact**
    - POST /risk/symbols/{s}/resume on an automatic-Open symbol: returns 202, engine ignores, journals BreakerCommandIgnored
    - breaker_view.detail_json.lastIgnored carries the command, reason, and ts
    - Rationale: honest API (the command is a no-op); transparency for ops monitoring
    - Tradeoff: client must handle "202 but nothing changed"
    - Tested by RA2 (both halt and resume on automatic Open)

15. **Cancel of terminal order is `409 order_not_cancellable`; prevents state machine confusion**
    - DELETE on REJECTED, CANCELLED, or FILLED: 409
    - DELETE on RESTING, ACCEPTED, RECEIVED, CANCEL_REQUESTED: 202
    - Rationale: prevent confused clients retrying cancels on impossible states
    - Tradeoff: tighter boundary checking; costs one projection lookup
    - Tested by OA11 (terminal cancel returns 409)

16. **Audit timeline order is display-only, not a correctness claim**
    - Timeline merges risk and engine events, ordered by: (ts, stage_rank, seq, idx)
    - stage_rank: RISK_COMMAND (1) < RISK_ACCEPT (2) < ENGINE (3) < RISK_NOTICE (4)
    - No shared sequence across streams; order is best-effort merge
    - Rationale: honest API (no false cross-stream ordering claim); ties broken causally
    - Tradeoff: client cannot infer ordering from timeline alone (must use seq within stream)
    - Tested by AE1 (display order, not correctness order)

17. **Deferred endpoints: amend, limits config, instruments CRUD, simulator, chaos**
    - Engine has no `AmendOrder` command; config for `ConfigureBreaker` not in risk core; instruments are core configuration; simulator and chaos are load-testing tools
    - Rationale: scope for Week 9 is core trading flow; these are extensions
    - Documented in OpenAPI as 404 stubs (or omitted entirely)
    - Testable: OA15 (amend returns 404)

18. **API depends on runtime; boundaries map updated**
    - api/ may depend on: common, journal (SqlExecutor type), projections, runtime, fastify, jose, @fastify/websocket, @fastify/multipart, prom-client
    - api/ must not depend on: pg directly, shard internals, risk cores, engine-core runtime imports
    - Rationale: clean separation; API is a port to core; facade is the contract
    - Enforced by check-boundaries.mjs
    - Tested by build (imports are compile-time verified)

19. **Single API instance for demo; multi-instance fan-out needs shared pub/sub**
    - In-process NoticeBus connects projector to WebSocket hub; in-memory single-flight and rate limiter
    - Multiple API instances need Kafka or Redis for notice fan-out
    - Rationale: proof-of-concept; clear upgrade path
    - Tradeoff: single point of failure; documented limitation
    - Documented in README LIMITATIONS section
