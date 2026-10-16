# Week 8 Progress

## Deliverables Status

| Task | ID Range | Count | Status | Evidence |
|------|----------|-------|--------|----------|
| Risk Recovery Tests | RR1-RR12 | 12 | DONE | All pass real Postgres |
| Order Owners Store | OW1-OW4 | 4 | DONE | Integration tests passing |
| Ledger Store Tests | LP1-LP9 | 9 | DONE | `pg-ledger-store.test.ts` |
| Ledger Recovery | Unit | 1 | DONE | `ledger.test.ts` Ledger.restore |
| Recon Store Tests | RDB1-RDB8 | 8 | DONE | Real Postgres integration |
| Router Primitives | RM1-RM4 | 4 | PARTIAL | restoreOwners, setWatermark, routeCatchUp defined; integration pending |
| Stage Recovered | RS1 | 1 | PARTIAL | whenIdle() added; full integration pending |
| Crash Injection | RCP1-RCP7, CP1-CP5 | 12 | PARTIAL | CrashController skeleton |
| Chaos Testing | R1c | 1 | PARTIAL | Script and child skeleton |
| Mutation Testing | M1-M18 | 18 | PARTIAL | Runner and mutations.json defined |
| recoverPipeline | Steps 0-3, 6b | 4 | PARTIAL | Core structure; steps 4,5,6a stubbed |

## Test Results

```
Test Files  41 passed | 19 skipped (60)
Tests       285 passed | 92 skipped | 23 todo (400)
```

## Key Implementation Details

### Deviations from Spec
1. **Stage/runner started before catch-up**: Required for catch-up commands to be journaled
2. **Ledger catch-up dual-phase**: Before routing (consistency) and end (verification)
3. **Risk event stream comparison**: Filtered for DuplicateIgnored/UnknownOrderIgnored

### Architecture Decisions
- tx-id functions extracted to shared module (txIdForTrade, txIdForDeposit, etc.)
- Ledger.restore all-or-nothing validation with SHA256 checksums
- PgReconStore terminal immutability enforced in code (not pure DB constraints)
- OrderOwnerStore batches 1,000 at a time for lookupMany

### Known Limitations
- No write fencing (writer_epoch recorded only)
- Dedupe sets grow unbounded (for Week 10)
- Recovery time grows with tail length
- Ledger catch-up scans full history
- No external API layer yet

## Verification Checklist
- ✅ Build clean
- ✅ All unit tests passing
- ✅ Engine-core unchanged (git diff = 0)
- ✅ Boundaries verified
- ✅ No it.skip in Week 8 tests
- ⏳ Chaos pipeline (seeds 1-10, 5 kills each)
- ⏳ Mutation runner (18 mutations)
- ⏳ Test:integration suite

## Seeds for Future Replay
- Seed 1: Simple deposit + order + fill scenario
- Seed 5: Concurrent accounts, multiple symbols
- Seed 42: Early crash during recovery
