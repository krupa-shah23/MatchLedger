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
- `npm ci` completed; npm reported one high-severity audit finding.
- `npm run build`, `npm run lint`, and `npm run check:boundaries` passed.
- `npm test` passed 250 tests and skipped 42 tests across 7 files.
- `npm run test:integration` could not run: the root package has no such script.
- `docker compose ps` reported no running services. `docker compose ps -a` showed the Postgres container exited; the Compose image tag is `postgres:18`, but no live server version was verified.
- `packages/engine-core` and `packages/shard/src/shard-runner.ts` have no diff.

### Week 5 acceptance coverage
The source test names found are J1, J4, J9, SS1, RC1, RC2, RC9, RC10, and R1. The journal/snapshot/recovery Postgres suites are guarded by `RUN_CONTAINERS` or `RUN_INTEGRATION` and were skipped in the default unit run. P7 is absent. Missing required IDs include J2-J3, J5-J8, J10-J14, SS2-SS7, and RC3-RC8, RC11-RC12. Consequently Week 5 is not proven and no Week 8 implementation steps were started.

### Next step
Restore the Week 5 integration setup and acceptance tests, start Postgres 18, and provide a root `test:integration` command. Re-run the full Step 1 gate and flake gate; begin Week 8 only after all required Week 5 IDs pass without skips.
