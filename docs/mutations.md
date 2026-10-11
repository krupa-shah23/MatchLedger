# Mutation sweep

This mutation audit was run in a temporary copy of the repo, never in the working tree. Each mutation changed one behavior at a time and then ran the smallest relevant Vitest slice.

## Summary

- Candidate mutations reviewed: 24
- Killed by tests: 23
- Not run: 1 (target file absent in this checkout)
- Survivors: 0

## Mutation table

| ID | Mutation | Expected tests | Observed result | Outcome |
| --- | --- | --- | --- | --- |
| 1 | break trip threshold used >= instead of > | `packages/engine-core/test/breaker.test.ts` | failed | killed |
| 2 | window not required to be full before volatility check | `packages/engine-core/test/breaker.test.ts` | failed | killed |
| 3 | open breaker accepted new trades | `packages/engine-core/test/breaker.test.ts` | failed | killed |
| 4 | halt timeout cancellation disabled | `packages/engine-core/test/breaker.test.ts` | failed | killed |
| 5 | half-open state kept stale window | `packages/engine-core/test/breaker.test.ts` | failed | killed |
| 6 | reset hysteresis removed | `packages/engine-core/test/breaker.test.ts` | failed | killed |
| 7 | incident timer reset on re-trip | `packages/engine-core/test/breaker.test.ts` | failed | killed |
| 8 | halt-timeout cancelled event mutated to wrong value | `packages/engine-core/test/breaker.test.ts` | failed | killed |
| 9 | force-cancel fired repeatedly after timeout | `packages/engine-core/test/breaker.test.ts` | failed | killed |
| 10 | Date.now() introduced inside breaker | `packages/engine-core/test/breaker.test.ts` | failed | killed |
| 11 | snapshot omitted forceCancelled metadata | `packages/engine-core/test/snapshot.test.ts` | failed | killed |
| 12 | tick injector ticked closed symbols | `packages/shard/test/tick-injector.test.ts` | failed | killed |
| 13 | `HaltSymbol` no longer updated risk state | `packages/risk/src/*.test.ts` | failed | killed |
| 14 | halted-symbol validation moved after reservation creation | `packages/risk/src/*.test.ts` | failed | killed |
| 15 | halt-timeout router release mapped to wrong state | `packages/risk/src/router.test.ts` | not run | target file absent in checkout |
| 16 | settlement mismatch ignored by recon matcher | `packages/recon/src/core/recon.contract.test.ts` | failed | killed |
| 17 | idempotency removed for recon runs | `packages/recon/src/core/recon.contract.test.ts` | failed | killed |
| 18 | workflow accepted terminal transition back to OPEN | `packages/recon/src/core/recon.contract.test.ts` | failed | killed |
| 19 | workflow accepted empty reason field | `packages/recon/src/core/recon.contract.test.ts` | failed | killed |
| 20 | risk adjustment not posted to ledger | `packages/recon/src/service.test.ts`, `packages/ledger/src/ledger.test.ts` | failed | killed |
| 21 | adjustment idempotency removed | `packages/recon/src/service.test.ts`, `packages/risk/src/core/risk-adjustment.test.ts` | failed | killed |
| 22 | CSV parser treated quoted commas as separators | `packages/recon/src/core/recon.contract.test.ts` | failed | killed |
| 23 | file hash computed per chunk instead of whole file | `packages/recon/src/core/recon.contract.test.ts` | failed | killed |
| 24 | cutoff boundary off by one | `packages/recon/src/core/recon.contract.test.ts` | failed | killed |

## Conclusion

The Week 7 migration is mutation-robust under the current test suite: every candidate mutation that could be executed was caught, and there were no survivors to fix. The remaining not-run case is a repository-layout gap rather than a surviving logic defect.
