# MatchLedger

MatchLedger is a deterministic, event-sourced trading and settlement engine built with Node.js and TypeScript.

## Recovery (Week 8 Complete)

**Durability Claim:** Kill the system at any point between or within the engine and risk stages, restart, and the final state (order books, reservations, balances, ledger, events) equals the uninterrupted run, with no lost order, no duplicate order, and no stranded reservation.

**Proven for:** Single risk partition, single shard, sequential + concurrent order flows with deterministic crash injection (RCP1-RCP7). 122 tests across 14 categories.

**Subsystems:**
- ✅ Engine recovery: snapshot + tail replay, event regeneration (Week 5, unchanged)
- ✅ Risk recovery: snapshot + tail, dedupe sets + halted symbols survive restore, redelivery via engine journal, notice catch-up
- ✅ Ledger recovery: atomic appends, idempotent catch-up from deposits/adjustments/trades, balance invariants verified
- ✅ Recon recovery: optimistic transitions, audit trail, idempotent by file hash
- ✅ Router recovery: owner map restored, MarketView rebuilt from book, watermark set to engine's last seq
- ✅ Codecs: strict (unknown type throws), versioned (v:1), exhaustive (adding new type fails to compile), deterministic (same value → same JSON)

**Test Results:**
- 317 tests passing (122 from Week 8, 195 from earlier weeks)
- RR1-RR12 (risk recovery), LP1-LP9 (ledger), OW1-OW4 (owners), RDB1-RDB8 (recon), RM1-RM4 (router), LC1-LC6 (catch-up), PR1-PR6 (pipeline), RCP1-RCP7 (crashes), RX1-RX7 (export/restore), RCD1-RCD7 (codecs), RJ1-RJ8 (journal), DO1-DO3 (outbox), RSC1 (scheduler), P24-P26 (properties)
- All on real Postgres 18 with deterministic PRNG-seeded scenarios
- Property tests (P24-P26): 40-200 runs each, cut-point recovery, sequential/concurrent flows
- Mutation framework: 18 mutations defined, runner ready
- Chaos script: 5 seeds × 5 SIGKILL kills each = 25 scenarios ready

**Known Limits (Documented):**
- ⚠️ **Dedupe sets unbounded:** decidedOrders, seenRequestIds, seenAdjustmentIds, appliedTradeIds, haltedSymbols grow without bound. Eviction deferred to Week 10. Mitigation: periodic restart.
- ⚠️ **No write fencing:** writer_epoch recorded but not enforced. Multi-instance failover requires fencing (Week 10).
- ⚠️ **Recovery time grows:** Tail length unbounded (no compaction). Snapshots mitigate (count-based scheduler RSC1). Full replay time grows O(tail_length).
- ⚠️ **Single partition:** Multi-partition orchestration (Week 9). Single partition proven recoverable independently.
- ⚠️ **Ledger catch-up sequential:** Scans full entry history per run. Idempotency absorbs repeats; performance acceptable for single partition.
- ⚠️ **No API yet:** Claims like "durably received" deferred to Week 9. Recovery is now durable; API will expose it honestly.
- ⚠️ **No fencing enforcement:** Prevents multi-instance concurrent writes. Week 10 adds enforcement (distributed coordination).

**Architecture:**
See [docs/WEEK-8.md](docs/WEEK-8.md) for crash windows, recoverPipeline sequence, state schema, and edge cases.
See [docs/decisions.md](docs/decisions.md) for rationale on atomicity, redelivery, dedupe survival, ledger durability, and scope.
