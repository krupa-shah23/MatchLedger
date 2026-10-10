# Decision log

## Decision 2 — sorted price array for the book

### Context
The book needs best-price access, deterministic ordering, and simple iteration
over the small number of active price levels.

### Options considered
- Balanced tree: logarithmic insertion and deletion, but more implementation
  complexity and less direct best-first snapshot iteration.
- Skip list: expected logarithmic updates, but probabilistic structure and
  additional pointer overhead.
- Sorted array: logarithmic binary search with a linear shift for new levels.

### Choice
Use a side-aware sorted array plus a `Map<bigint, PriceLevel>`. Bids are
ascending and asks descending, with the best price at the last element.

### Trade-offs and switch point
The array is deterministic, compact, and sufficient for the expected active
level count. Switch to a balanced tree when measured active levels make the
linear shift dominate matching throughput or tail latency; preserve the
`Map` and `SortedPrices` interface so the book API remains stable.

## Decision 18 — fast-check

### Context
Core invariants need reproducible generated cases.

### Options considered
Examples only; custom harness; fast-check.

### Choice
Use fast-check with Vitest.

### Trade-offs
More suite time, but shrinking and replay.

## Decision 19 — breaker folder

### Context
Breaker transitions replay with matching.

### Options considered
Separate package; engine-core folder.

### Choice
`engine-core/src/breaker`.

### Trade-offs
Implementation, not package boundary.

## Decision 20 — Node and TypeScript

### Context
Need a single writer and shared contracts.

### Options considered
Node/TS; Java; systems language.

### Choice
Node 24 and TypeScript 6.

### Trade-offs
GC tail latency and no shared-memory parallelism.

## Decision 22 — TypeScript pin

### Context
TS7 has toolchain risk.

### Options considered
TS7; TS6.

### Choice
Pin 6.0.3.

### Trade-offs
Defer TS7 features.

## Decision 23 — Google Stitch as a UI reference, React as the product

### Context
The dashboard needs a credible visual design without sacrificing the typed, testable frontend architecture in the blueprint.

### Options considered
- Build screens directly from an ad-hoc React layout.
- Ship the HTML/CSS exported by Google Stitch.
- Use Stitch exports as visual references and rebuild the screens in React.

### Choice
Design in Google Stitch and save each export under `web/design/<page-name>/`. Treat the exported HTML, CSS, and screenshots as reference material only; rebuild each screen as React 19 + TypeScript components in `web/src`, using React Router 7, TanStack Query 5, and the single `useSocket` hook.

### Trade-offs
This introduces a translation step and visual-regression responsibility, but avoids shipping static export code, preserves routing/data boundaries, and keeps UI behavior aligned with the asynchronous API contract. Decimal-string money remains display-only; estimates are labelled; 202 responses stay pending until an outcome event arrives. Shared route guards live in `common` so frontend access rules track the section 3.4 role matrix.

## Decision 24 — public registration is demo-only and TRADER-only

### Context
The demo needs a low-friction path for reviewers to experience the trader flow, without exposing account creation or role escalation as production behavior.

### Options considered
- Public registration in every deployment with role selection.
- No public registration; seeded accounts only.
- Registration only in the demo profile, creating a fixed TRADER setup.

### Choice
`POST /auth/register` is public only in the demo profile. It creates a TRADER user, one account, and a fixed simulated ledger deposit. The role is never accepted from the request.

### Trade-offs
This improves demo usability but is deliberately not a production identity design. It cannot create privileged users and is rate-limited; production would use managed identity, verification, funding controls, and operator-controlled roles.

## Decision 25 — non-resting cancel reason

### Context
Cancel commands can target a filled, previously cancelled, or unknown order.

### Choice
Use one stable reason, `ORDER_NOT_RESTING`, for every cancel that does not find a resting order.

### Trade-offs
The reason is less specific, but keeps the public contract small and deterministic.

## Decision 26 — self-trade is allowed in Week 2

### Context
Self-trade prevention is a policy concern separate from the price-time book.

### Choice
Allow orders from the same account to trade against each other during this week.

### Trade-offs
This keeps the matching core simple; prevention can be added as an explicit later policy.

## Decision 27 — retain every accepted order id

### Context
Reusing an order id after it has fully filled could make replay and audit identity ambiguous.

### Choice
Check duplicate ids against all ids ever accepted, not only currently resting ids.

### Trade-offs
The engine retains a growing `Set<string>`, trading memory for deterministic idempotency.

## Decision 24 — Week 2 engine conventions
### Choice
- Self-trade is allowed (tested); preventing it is a stretch feature.
- The engine validates again even though the API validates at the edge (defense in depth); validation order is duplicate id, quantity, price, tick, lot, max quantity, max price.
- `engineSeq`, `arrivalSeq` and the trade counter are deterministic bigint counters; `tradeId` is `<symbol>-T<n>`; no clock or randomness.
- Names follow the code, not the Week 2 draft: `ORDER_NOT_RESTING`, `INVALID_TICK`, `INVALID_LOT`.
- Duplicate ids are rejected forever (see the duplicate-id decision above); `Engine.seenOrderIds()` lets a snapshot persist them.
### Verification
`Engine.checkInvariants()` runs after every command in the P1 property test and in U18/U20.

## Decision 28 — IOC price semantics
### Context
The engine has one price field and must express bounded immediate execution.

### Options
- Add a separate cap/floor field.
- Treat the existing limit price as the IOC bound.

### Choice
Use `price` as the limit for GTC and as an inclusive hard cap/floor for IOC.
Market orders remain a later risk-stage concept converted to capped IOC.

### Trade-offs
The public command remains small and deterministic; market-price selection is
kept out of the matching core. Tested by U9, U25, U26, and P13.

## Decision 29 — IOC remainder is an event
An unfilled IOC remainder emits `ORDER_CANCELLED` with reason
`IOC_REMAINDER` and the remaining quantity. The risk stage can release its
reservation from that event. Tested by U8, U23, and U34.

## Decision 30 — IOC never enters the resting book
An IOC remainder does not touch `orderIndex` or a price level. Cancelling its id
therefore yields `ORDER_NOT_RESTING`; the engine may reuse only the existing
accepted-id policy. Tested by U10, U27, and P13.

## Decision 31 — Inclusive IOC cap and floor
IOC BUY prices satisfy `tradePrice <= price`; IOC SELL prices satisfy
`tradePrice >= price`, including equality. Tested by U26.

## Decision 32 — Self-trade includes IOC
Self-trade remains allowed for IOC as well as GTC; prevention is a later policy
stage. Tested by U33.

## Decision 33 — Edge quantity parser
The common edge parser accepts canonical strings for large quantities and
rejects numbers beyond `2**53`. Tested by Q1 to Q8.

## Decision 34 — Differential and command-derived properties
D1 compares the engine to an independent reference matcher. P2 to P4 and P12
to P13 derive facts from commands and events rather than engine bookkeeping.
Both are retained because differential testing finds model divergence while
command-derived properties check conservation and identity independently.

## Decision 35 — Week 3 benchmarks are baseline only
The B1 to B7 benchmark is a reproducible baseline; optimization is deferred to
Week 11. Benchmark results do not establish production performance.

## Decision 25 — Week 3 IOC semantics
### Context
IOC orders must never rest and must stay deterministic and replayable.
### Options considered
A separate IOC matcher; a shared match loop with a time-in-force branch only at the tail.
### Choice
- One shared match loop; only the tail branches: an IOC remainder emits `ORDER_CANCELLED` with reason `IOC_REMAINDER` after the trades, a GTC remainder rests. Fully filled IOC emits no cancel; a rejected IOC emits only `ORDER_REJECTED`.
- An IOC order's price is an inclusive hard limit (BUY cap, SELL floor). Trades execute at the maker price.
- IOC never touches the order index or any level; it still advances `arrivalSeq` and `engineSeq`.
- Duplicate ids stay rejected forever (decision above), so an id cannot be reused after an IOC completes. This deviates from the Week 3 draft ("only resting ids") on purpose: deterministic idempotency over memory.
- Self-trade stays allowed, including IOC (U33).
### Trade-offs
The seen-id set grows without bound; pruning is a Week 5 snapshot decision.
### How tested
U8-U10, U22-U34 in `packages/engine-core/test/ioc.test.ts`; D1 (engine vs independent plain-array reference, 5,000 runs, GTC/IOC/cancels/invalid input); mutation checks M1 (IOC rests), M2/M3 (flipped cross operators), M8 (arrivalSeq on IOC) each fail at least one test.

## Decision 26 — Duplicate ids: resting-only (supersedes the reject-forever rule in Decision 25)
### Context
Reject-forever required an unbounded set inside the engine that snapshots would have to persist; docs/week-3.md and the blueprint put global dedupe at the gateway and risk stage.
### Options considered
Reject any id ever seen; reject only ids currently resting.
### Choice
The engine rejects `DUPLICATE_ORDER_ID` only while an order with that id is resting. `acceptedOrderIds` and `seenOrderIds()` were removed. An id may be reused after it fills, is cancelled, or an IOC completes.
### Trade-offs
Replaying a duplicated command with a finished id would be accepted by the engine alone; the gateway `(accountId, clientOrderId)` dedupe, risk-stage dedupe and journal sequence numbers must prevent that.
### How tested
engine.test.ts (duplicate while resting, reuse after fill, reuse after cancel), ioc.test.ts U28 (both halves), D1 and the reference-model equivalence property.
