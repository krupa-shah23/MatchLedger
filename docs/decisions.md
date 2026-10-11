# Decision log

## Decision 1 — Single-writer matching by symbol

### Context
The matching engine must be deterministic and easy to recover. Replaying the same journaled commands must yield the same trade stream and the same order book state.

### Options considered
- One global lock around all matching
- Per-symbol single-writer shards with a shared journal
- Event-driven distributed matching with cross-shard coordination

### Choice
Use a single-writer model per symbol: one shard owns a symbol’s book and applies commands sequentially in its event loop.

### Trade-offs
This gives straightforward ordering and fewer data races, but it creates a shard boundary that must be respected in routing and in recovery. The design is simpler and more testable than a distributed lock-free engine.

### How tested
The engine and breaker tests assert deterministic trade ordering, replay equivalence, and symbol-isolated state transitions.

## Decision 2 — Bigint money, quantity, price, and tick size

### Context
Financial values are exact and must not lose precision during arithmetic or comparison.

### Options considered
- JavaScript numbers with rounding guards
- decimal strings with custom arithmetic
- bigint minor-unit arithmetic

### Choice
Store prices, quantities, and money in bigint minor units and keep all arithmetic in integer space.

### Trade-offs
The code becomes more explicit and defensive, but it avoids float drift and requires all adapters to preserve the integer representation.

### How tested
The common money and quantity test suites validate canonical parsing, arithmetic invariants, and boundary behavior.

## Decision 3 — Map-based keyed collections

### Context
Price-keyed collections and id-keyed mappings must be deterministic and never rely on object key ordering.

### Options considered
- Plain objects keyed by string
- `Map` collections only
- Tree structures with custom ordering code

### Choice
Use `Map` for price-keyed and id-keyed collections and keep any ordering logic explicit.

### Trade-offs
This is slightly more verbose than object maps, but it preserves stable semantics and avoids key coercion pitfalls.

### How tested
The engine, recon, and breaker suites validate state recovery and deterministic ordering under repeated commands.

## Decision 4 — Journal-first event sourcing

### Context
The system must survive crashes without losing the exact sequence of commands that produced state.

### Options considered
- Keep only in-memory state with best-effort snapshots
- Persist commands and rehydrate from a journal
- Persist only derived projections

### Choice
Treat the journal as the source of truth for command replay and rebuild state from the journal plus snapshots.

### Trade-offs
This adds operational complexity, but it allows exact recovery and auditability. The matching engine is durable; risk, ledger, and recon retain separate scope limits.

### How tested
Recovery and snapshot suites exercise replay, deterministic reconstitution, and compatibility via versioned snapshots.

## Decision 5 — Reject before mutation

### Context
A rejected command must leave state unchanged.

### Options considered
- Mutate first, then reject on failure
- Validate first, then perform mutation
- Mixed validation with partial writes

### Choice
Perform all validation first, then issue a single state mutation on success.

### Trade-offs
This makes the state machine easier to reason about but requires slightly more explicit validation code. The cost is justified by correctness and simpler replay semantics.

### How tested
Risk-core and reconciliation tests confirm that invalid or halted orders produce rejection events without altering ledger or reservation state.

## Decision 6 — Circuit breaker as a state machine

### Context
The engine must protect itself from sustained volatility spikes and avoid hysteresis bugs.

### Options considered
- Hard stop on every trade spike
- One-time halt without recovery
- Explicit closed/open/half-open machine with cooldown and reset thresholds

### Choice
Use a closed/open/half-open breaker driven by rolling-window volatility and an explicit halt timeout.

### Trade-offs
The state machine adds more behavior, but it is deterministic and easier to audit in production. It is also the basis for manual halts and resume flows.

### How tested
The breaker suite exercises trip thresholds, cooldowns, half-open reset logic, and manual halt/resume semantics.

## Decision 7 — Halted-symbol rejection before reservation

### Context
A symbol that is halted must reject order submission before a reservation is created or held.

### Options considered
- Allow submission, then reject after reservation
- Reject at submission without reservation
- Defer until settlement risk checks

### Choice
Check the symbol halt state before reservation creation and emit `SYMBOL_HALTED` immediately.

### Trade-offs
This is stricter and safer for clients, but it means the risk layer must be validated before account holds are booked. It preserves the invariant that rejected commands never leave a reservation behind.

### How tested
Risk-core and system tests assert the early rejection path and the absence of reservation mutation on halted symbols.

## Decision 8 — Double-entry ledger invariant

### Context
Each trade must leave the ledger balanced and explainable.

### Options considered
- Single-sided balance updates
- Debits and credits tracked in separate logs
- Double-entry postings with suspense handling

### Choice
Every fill posts balanced debits and credits, and suspense entries remain explicit when a balance is temporarily withheld.

### Trade-offs
This is slightly more verbose, but it preserves auditability and the invariant that ledger totals remain balanced even under adjustment flows.

### How tested
Ledger and reconciliation tests validate balanced postings and the correct handling of suspense and adjustment outcomes.

## Decision 9 — Breaks and workflow resolution

### Context
Internal and external records may disagree and must be visible in a formal remediation workflow.

### Options considered
- Log mismatches without workflow
- Surface a passive status list
- Create a typed break workflow with required reasons and immutable terminal states

### Choice
Use a break workflow with explicit transitions, mandatory actor/reason metadata, and terminal immutability for resolved and written-off states.

### Trade-offs
This adds more state modeling but turns reconciliation into a reviewable, auditable process. It also keeps the service-layer final state consistent with the ledger and risk state.

### How tested
Recon workflow tests assert legal transitions, required reason fields, terminal immutability, and age tracking from creation time.

## Decision 10 — Recovery scope is intentionally limited

### Context
Persistence work is staged and not all subsystems are durable yet.

### Options considered
- Claim full system durability immediately
- Scope recovery to the matching engine only
- Delay all claims until risk, ledger, and recon are durable

### Choice
Claim recovery only for the matching engine. Risk, ledger, and reconciliation are deterministic and replayable in tests, but they are not durable yet.

### Trade-offs
This is honest and keeps the project aligned with the Week 7 blueprint, but it narrows the marketing claim. The docs explicitly state this boundary to avoid over-claiming.

### How tested
The README and project status files keep this scope statement explicit; the Week 5 timers remain outside the Week 7 flake gate because they are deferred by design.

## Decision 11 — CSV and date parsing must be strict

### Context
Recon inputs can contain quoted fields, embedded commas, and edge settlement dates. A tolerant parser cannot hide malformed data.

### Options considered
- Accept malformed CSV and silently coerce values
- Parse strictly and return row-level errors
- Skip bad rows without an audit trail

### Choice
Strict CSV parsing with row errors for malformed quoted data, invalid UTF-8, and invalid settlement-date conversion.

### Trade-offs
The parser is less forgiving, but it produces trustworthy break reasons and preserves operator visibility.

### How tested
Recon contract tests cover BOM handling, quoted commas, escaped quotes, invalid UTF-8, and settlement-date edge cases.

## Decision 12 — Deterministic IDs and counters

### Context
Every command, order, fill, and trade must carry a stable identity so that replay and audit remain deterministic.

### Options considered
- Random ids
- Wall-clock derived ids
- Journal-driven counters and deterministic symbols

### Choice
Use deterministic counters from the engine state and explicit journal inputs rather than clock or randomness.

### Trade-offs
This keeps replay exact but requires careful id generation and state retention. The benefit is strong auditability and simplified down-stream matching.

### How tested
Trade and sequence tests assert monotonic counters and stable trade identifiers across repeated runs.

## Decision 13 — No async and no incidental runtime dependencies in engine-core

### Context
The engine must remain pure, synchronous, and dependency-light.

### Options considered
- Mixed async engine with runtime dependencies
- Synchronous pure engine with strict dependency boundaries
- Shared runtime packages for low-level tasks

### Choice
Keep `engine-core` free of async code, `Date`, `Math.random`, `node:*` imports, and runtime dependencies beyond the project’s own packages.

### Trade-offs
This makes the core slower to integrate with the surrounding infrastructure, but it preserves correctness, determinism, and boundary quality.

### How tested
Boundary checks and lint rules reject forbidden imports and timer usage inside the pure engine package.

## Decision 14 — Risk-first, ledger-second, break-status-last adjustment ordering

### Context
Adjustments must be validated in the same order as the real workflow: risk before ledger and only then update the reconciliation break state.

### Options considered
- Update ledger first
- Update break status first
- Risk validate then ledger post then break status

### Choice
Apply the adjustment at the risk layer, then post it to the ledger, and only at the end update the break’s workflow status.

### Trade-offs
This introduces a deliberate sequencing requirement, but it keeps the overall system consistent and prevents a rejected adjustment from mutating downstream state.

### How tested
Service-level tests assert the exact order of operations and the fact that `ADJUSTMENT_REJECTED` leaves the break unchanged.

## Decision 15 — Route guards follow the role matrix

### Context
The UI must respect the same permission boundaries as the public API.

### Options considered
- Hide controls without enforcing server-side checks
- Duplicate route logic in each screen
- Centralize the role matrix in a browser-safe common package

### Choice
Derive route guards from the role matrix and keep them in a shared browser-safe common package.

### Trade-offs
This introduces a shared abstraction, but it prevents the UI and backend from drifting apart.

### How tested
The frontend contract is checked against the section 3.4 role model and the API route map rather than ad hoc screen logic.

## Decision 16 — Mutation gating in a temporary copy

### Context
The project needs evidence that the tests would catch logic regressions rather than simply passing on the current code.

### Options considered
- Trust the suite without mutation analysis
- Run mutation tests in-place and risk polluting the working tree
- Run mutation tests in a temporary copy and record the results

### Choice
Run the mutation sweep in a temporary copy, never on the active checkout, and record expected/actual outcomes in a documentation artifact.

### Trade-offs
This takes longer than a normal test run, but it removes the risk of mutating the workspace itself and produces evidence that the suite is sensitive to the correct behaviors.

### How tested
The temp-copy sweep covered 24 targeted mutations; 23 were killed and 0 survived. The one unrun case was a missing target file in the current checkout, not a surviving defect.
