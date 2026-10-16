# Progress

## Week 7 status

The Week 7 implementation set is complete and verified in the current checkout. The core work includes the breaker state machine, symbol halt policy in risk, strict recon parsing and settlement logic, the workflow/adjustment ordering fix, and the final mutation audit.

### Verified implementation work
- Breaker closed/open/half-open behavior, volatility thresholding, manual halt/resume, and timeout cancellation.
- Early `SYMBOL_HALTED` rejection before reservation creation, with no mutation on rejected orders.
- Recon CSV parsing, negative-day settlement-floor logic, workflow state checks, and matcher comparisons.
- Risk/ledger/break ordering for adjustments and the `ADJUSTMENT_REJECTED` no-op case.
- Temp-copy mutation sweep covering 24 candidate mutations; 23 killed, 0 survivors, 1 not run because the target file is absent in this checkout.

### Verification commands run
- `npm run build`
- `npm run lint`
- `npm run check:boundaries`
- `npm test`

All four commands were run and validated in the current state.

### Deferred items
The Week 5 timers remain intentionally deferred and outside the Week 7 flake gate:
- `postgres.integration`
- `chaos`
- `runner.recovery`

These are not part of the Week 7 gate and should not be used to block the completed implementation work.

### Recovery scope
Recovery covers the matching engine only; risk, ledger and recon are not durable.

## Week 8 preflight status

Week 8 implementation is blocked at Step 1. `docs/week-8.md` is present in the worktree as an untracked user-provided spec and has been preserved.

### Verification run
- Earlier `npm ci` completed; npm reported one high-severity audit finding.
- Current recheck (2026-10-14): `npm run build` passed; `npm run lint` failed with 43 errors; `npm run check:boundaries` passed.
- Current `npm test`: 36 files passed, 19 skipped; 251 tests passed, 42 skipped, 67 todo.
- `npm run test:integration` cannot run because the root package has no such script.
- `npm run test:flake` reports 20/20 for its configured unit runs, but each run still has 14 skipped files and 60 todo tests; it does not prove Postgres integration behavior.
- `docker compose ps` reports no running services. The `postgres:18` container is exited, so no live Postgres version was verified.
- The current worktree has an existing diff in `packages/engine-core/src/index.test.ts` and `packages/shard/test/chaos.test.ts`; `ShardRunner.run()` itself was not shown as changed. The protected `engine-core` no-diff requirement is therefore not met. These changes were present before this recheck and were not reverted.

### Week 5 acceptance coverage
The current source has real but Docker-gated cases J1, J4, J9, SS1, RC1, RC2, RC9, and RC10. These suites are guarded by `RUN_CONTAINERS` or `RUN_INTEGRATION`, and no integration command or live Postgres service is available. J2-J3, J5-J8, J10-J14, SS2-SS7, RC3-RC8, and RC11-RC12 are missing. P7 has no real Postgres-backed test (the property file's suite label mentions P7, but its only test is P8). The current R1 test is a TODO, not a passing chaos test. Consequently Week 5 is not proven and the Week 8 prompt pack requires stopping at its Step 1 gate.

### Next step
Restore the Week 5 integration setup and acceptance tests, start Postgres 18, and provide a root `test:integration` command. Re-run the full Step 1 gate and flake gate; begin Week 8 only after all required Week 5 IDs pass without skips.

## Week 8 honest status

This task intentionally stopped at the honest checkpoint rather than pretending the durable replay work exists. The repo was reset to avoid false green tests by replacing placeholder-only suites with `it.todo(...)` entries while preserving the real assertions that were already valid.

### What changed
- `RiskCore.restore()` is no longer a stub in the current checkout; the real implementation validates a snapshot and rejects invalid restore payloads with `InvalidRiskStateError`.
- Placeholder tests across the Week 8 risk, persistence, runtime, shard, and system-test areas were converted to honest TODOs so they no longer report false-pass green status.

### Direct restore verification
A direct runtime check against the compiled implementation reported:
- `VALID_RESTORE true 1000`
- `BAD_VERSION InvalidRiskStateError VERSION`
- `BAD_RESERVATION InvalidRiskStateError RESERVATION_NOT_DECIDED`

This proves the current `restore()` implementation validates successful state and rejects malformed state. It is not yet a complete durable recovery implementation, but it is not a stubbed throwaway call.

### Restore review gaps
- Configuration validation compares instrument symbols only; it does not compare every instrument field as required by `docs/week-8.md` 4.3.
- Restore sums BUY reservation amounts for `heldCash`, but does not sum SELL reservation quantities against each position's `heldShares`; `checkInvariants()` does not fill that gap.
- A zero `qtyRemaining` reservation is not rejected, although the restore checklist requires positive remaining quantity.
- These are review findings only. `RiskCore.restore()` is hand-written by the user per the Week 8 prompt and was not edited here.

### Verification run
- `npm run build`: passed.
- `npm run lint`: failed with 43 existing rule violations (no-explicit-any and legacy async/sync boundary errors in unimplemented persistence/runtime files).
- `npm run check:boundaries`: passed.
- `npm test -- --run`: 36 files passed, 19 skipped, 251 tests passed, 42 skipped, 67 todo.

### Deviation from spec
The repository remains intentionally below the full Week 8 durable recovery target. The existing work does not satisfy the missing `test:integration` and Postgres-backed recovery gate, so no feature-completion claim is being made.
