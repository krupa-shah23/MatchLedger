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
