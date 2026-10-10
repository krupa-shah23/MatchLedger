Week 3: IOC Orders, Price Caps, Full Property Suite and First Benchmark (engine-core)
One-week working document. Put it in docs/WEEK-3.md. It covers the second half of blueprint "Weeks 2 to 3". Week 4 (single-writer runner, naive-async comparison) is previewed at the end. Time budget: 10 to 15 hours.
Rule for this week: you hand-write the IOC code path in apply and the extended reference matcher. AI tools may help with test scaffolding, the benchmark harness, and review only (section 9).

0. Status and carry-over from Weeks 1 and 2
Week 2 is complete except for items you flagged yourself. Close these first (about 2 hours, Day 1). They are not optional, because Week 3 builds directly on them.
#
Carry-over
Done when
C1
Exact-event test for Example 1, steps 4 to 8 (sweep, price-through, partial fills, cancel, cancel again)
Test asserts the exact event array and the book (depth, restingOrders) after every step
C2
Exact-event test for Example 3 (cancel head, middle, tail in three separate runs)
After each cancel the remaining orders match in arrival order and checkInvariants() is []
C3
Whiteboard exercise from Week 2 section 11 (Example 1, step 4), done without notes
You can name which of levels, prices, list pointers and orderIndex each trade mutates
C4
Week 1 leftovers: docker compose pull/up, live spikes, CI green, two unchecked boxes in docs/versions.md
Ticked, or consciously deferred. Spike 4 (Kafka transactions and fencing) must be done by Week 5. Do not let it block Week 3

Why C1 and C2 matter now: IOC changes the tail of apply. If the Week 2 exact-event tests are thin, a regression in GTC behaviour will hide behind IOC work.

1. Goal and scope
Goal: finish the matching core so it handles everything the blueprint requires of engine-core before the runner exists: GTC and IOC limit orders (with the limit acting as a hard price cap or floor), cancel, validation, all five matching properties, a differential test at scale, and a first honest micro-benchmark.
In scope this week
Deferred
timeInForce: 'GTC' | 'IOC' on PlaceOrder
Market orders and the reference-price fallback chain (risk stage, Week 7: U13, U14, P9)
IOC matching: sweep within the cap, cancel the remainder, never rest
Amend / cancel-replace (optional stretch, section 5.4)
OrderCancelled.reason (USER_REQUEST, IOC_REMAINDER)
FOK, stop orders, self-trade prevention (stretch)
Edge-input parsing for quantities in common (U12)
zod schemas and the full API validation layer (Week 9)
Properties P2, P3, P4, plus new P12, P13, P14
Snapshots, exportState(), replay (Weeks 5 to 6)
Larger-scale differential test D1 with IOC
Input stage, ts stamping, queues, Ticks (Week 4)
tinybench micro-benchmarks, baseline only (F1 partial)
Any optimization (Week 11, experiment E3)


2. Deliverables and definition of done
[x] C1 to C4 closed (section 0)
[x] types.ts: timeInForce on PlaceOrder, reason on OrderCancelled
[x] OrderBook.apply handles IOC; the IOC remainder is never rested and never enters orderIndex
[x] common/src/quantity.ts: edge parser for quantities (U12b), browser-safe, no node:*
[x] Reference matcher and generators extended with IOC and multiple instrument specs
[x] All tests in section 8 pass: U8 to U10, U12a/b, U22 to U34, EX1 to EX3, Q1 to Q8, P1 to P4, P11 to P14, D1
[x] packages/benchmarks: tinybench scenarios B1 to B7 run via npm run bench; results in docs/experiments.md (baseline table, hardware noted)
[ ] npm run build, lint, check:boundaries, test all green; CI green
[x] docs/decisions.md updated with the decisions in section 10
[x] PROGRESS.md updated, including seeds of any property failures you hit and fixed
[ ] Whiteboard (section 11) done without notes
Definition of done: every box ticked and you can explain, from memory, how an IOC buy with a cap of 102 sweeps asks at 101 and 102, stops before 103, cancels its remainder, and why that remainder never touches the book.

3. Technologies and tech stack (this week only)
Tool
Version
Used for
TypeScript
6.0.x (your pin), strict, noUncheckedIndexedAccess
Engine and tests
Vitest
4.1.x (your pin)
Test runner
fast-check
4.x (your pin)
Properties, model-based testing, shrinking, seed replay. Use fc.assert inside normal Vitest tests unless @fast-check/vitest is already installed
tinybench
npm view tinybench version, then pin
First real micro-benchmarks in packages/benchmarks
node --cpu-prof
built into Node 24
One profile of the match path, for the baseline notes only
ESLint 10 purity rules
as pinned
Unchanged. Do not weaken them

New runtime dependencies in engine-core: none. benchmarks may depend only on engine-core and tinybench (blueprint 4.4). common may depend on engine-core types and zod, but this week's parser needs neither (plain TypeScript, so it stays testable and browser-safe).

4. Architecture
4.1 What changes in the code
packages/engine-core/
  src/
    types.ts            // + timeInForce, + OrderCancelled.reason
    book/               // unchanged structurally
    matching/
      validate.ts       // unchanged rules; IOC price is validated exactly like GTC
    book/order-book.ts  // apply(PlaceOrder): TIF branch after the match loop
  test/
    helpers/
      reference-matcher.ts  // + IOC
      arbitraries.ts        // + timeInForce, + several InstrumentSpecs
      event-analysis.ts     // NEW: derive per-order fills / trades from an event stream
    order-book.test.ts      // + U22 to U34, EX1 to EX3
    properties.test.ts      // + P2, P3, P4, P12, P13, P14, D1 at scale
packages/common/
  src/quantity.ts       // NEW: parseQuantity (edge parser)
  test/quantity.test.ts // Q1 to Q8
packages/benchmarks/
  src/book.bench.ts     // NEW: B1 to B7
  package.json          // "bench" script

4.2 IOC semantics (the whole feature in five lines)
An IOC order is a limit order whose price is a hard limit: a cap for a BUY, a floor for a SELL. It trades only at resting prices that satisfy it (cap and floor are inclusive).
It matches exactly like GTC: best opposite price first, then arrival order within the level, trade price is the resting order's price.
After the match loop, any unfilled remainder is cancelled, never rested.
The cancellation is an event: OrderCancelled { orderId, remaining, reason: 'IOC_REMAINDER' }, emitted after the trades. A downstream risk stage uses it to release the unused reservation.
An IOC order never enters orderIndex and never enters a level, so a later CancelOrder for it returns CancelRejected(UNKNOWN_ORDER).
Why no separate priceCap field: when the risk stage converts a market order (Week 7) it sets price to the computed cap or floor and timeInForce to IOC. One field with one meaning keeps the engine free of order-type branching. This is a decision to record (section 10).
4.3 Data flow of apply (changes highlighted by the TIF branch)
flowchart TD
    A[apply PlaceOrder] --> C[validate]
    C -->|invalid| R1[OrderRejected]
    C -->|ok| D{orderId resting?}
    D -->|yes| R2[OrderRejected DUPLICATE_ORDER_ID]
    D -->|no| E[match loop vs opposite side<br/>stop when price no longer satisfies limit]
    E --> F{remaining > 0?}
    F -->|no| H[done: order fully filled]
    F -->|yes| G{timeInForce}
    G -->|GTC| I[rest at own side<br/>emit OrderRested<br/>add to orderIndex]
    G -->|IOC| J[emit OrderCancelled<br/>reason IOC_REMAINDER<br/>no level, no index entry]

4.4 Event shapes (additions)
type TimeInForce = 'GTC' | 'IOC';

type PlaceOrder = {
  type: 'PlaceOrder'; orderId: string; accountId: string; side: 'BUY' | 'SELL';
  price: bigint;            // GTC: limit price. IOC: hard cap (BUY) or floor (SELL)
  quantity: bigint;
  timeInForce: TimeInForce; // NEW
  ts: number;
};

type CancelReason = 'USER_REQUEST' | 'IOC_REMAINDER';   // later: 'HALT_TIMEOUT' (Week 8)
type OrderCancelled = {
  type: 'OrderCancelled'; orderId: string; remaining: bigint;
  reason: CancelReason;     // NEW
  ts: number;
};

Keep existing RejectReason names exactly as they are in your types.ts. Do not rename them this week.
4.5 Test architecture (why this week's tests are non-circular)
flowchart LR
    G[fast-check generator<br/>commands + instrument spec] --> E[OrderBook engine]
    G --> R[Reference matcher<br/>plain array + sort]
    E --> EV1[events + restingOrders]
    R --> EV2[events + restingOrders]
    EV1 --> CMP{D1: deep equal}
    EV2 --> CMP
    EV1 --> AN[event-analysis.ts<br/>per-order fills, trades]
    AN --> PR[P2, P3, P4, P12, P13<br/>checked against the commands, not against the reference]
    E --> INV[checkInvariants after every command]

Two independent oracles: D1 compares against a different algorithm, while P2 to P4 and P12 to P13 check the engine against rules derived from the commands themselves. Either can catch what the other misses.
4.6 Complexity (additions)
Operation
Cost
Why
IOC with no liquidity
O(1)
bestPrice() fails the limit check immediately; no mutation
IOC sweep of k makers across L levels
O(k + L) plus O(1) per emptied best level
same loop as GTC; emptied best levels are pop()
IOC remainder
O(1)
one event, no structure touched


5. How to build it (day by day)
Write the failing test first each day, then the code.
Day
Hours
Do
Done when
1
2
Close C1 to C4 (section 0). Re-run Spike 2 (purity lint) to confirm it still fires
Carry-over green; lint proof re-confirmed
2
2
Update types.ts (section 4.4). Add timeInForce to existing tests (GTC). Write failing tests U8 to U10, U22 to U34 from Examples 4 to 8 (section 6)
All Week 2 tests still pass; new IOC tests exist and fail for the right reason
3
2 to 3
Implement the TIF branch in apply (hand-written). Make U8 to U10 and U22 to U34 pass. Run checkInvariants() after every command in every IOC test
All unit tests green; no IOC order visible in restingOrders()
4
2
common/src/quantity.ts and Q1 to Q8. Add the engine-level max-bound test (U12a)
U12a and U12b green; common has no node:* import (boundary check green)
5
2 to 3
Extend the reference matcher with IOC. Extend generators (TIF, specs). Write event-analysis.ts, then P2, P3, P4, P12, P13, P14. Re-run D1 at scale
5,000+ runs pass; any failure reproducible by seed
6
2
packages/benchmarks: B1 to B7. Record baseline and hardware in docs/experiments.md. One --cpu-prof run
npm run bench works; table committed
7
1 to 1.5
Decisions (section 10), complexity table, PROGRESS.md, whiteboard (section 11), cleanup
Docs updated, everything green, CI green

Stuck protocol (same as Week 2): if a bug costs more than 90 minutes, stop, re-run the property with the printed seed, and debug from the shrunk counterexample, not the 300-command one.
5.1 IOC change in the match path (pseudocode; write the real code yourself)
apply(PlaceOrder o):
    ... validate, duplicate check, match loop exactly as in Week 2 ...
    // match loop condition stays: stop when opposite side is empty
    // or best price no longer satisfies o.price (BUY: best > o.price, SELL: best < o.price)

    if remaining > 0n:
        if o.timeInForce == 'GTC':
            rest at own side; orderIndex.set; events.push(OrderRested)
        else:   // IOC
            events.push(OrderCancelled(o.orderId, remaining, 'IOC_REMAINDER', o.ts))
            // do NOT create a node, do NOT touch orderIndex
    return events

The only new branch is the one at the bottom. If you find yourself changing the match loop for IOC, stop: the loop is identical, and that is the point.
5.2 Edge parser for quantities (common), U12b
Purpose: the blueprint requires that a JSON number beyond the safe-integer range is rejected at the edge, with no precision loss. By the time a value is a JavaScript number, precision may already be gone, so the parser must reject unsafe numbers instead of converting them.
type QuantityError = 'INVALID_QUANTITY' | 'UNSAFE_INTEGER' | 'ABOVE_MAXIMUM';
type Parsed = { ok: true; value: bigint } | { ok: false; error: QuantityError };
function parseQuantity(input: unknown, max: bigint): Parsed

Rules:
number: must satisfy Number.isSafeInteger (else UNSAFE_INTEGER if it is an integer-valued number beyond the range, INVALID_QUANTITY for NaN, Infinity, fractions)
string: canonical non-negative decimal only, ^(0|[1-9][0-9]*)$ (rejects "1e3", "0x10", "007", " 5", "", "-1", "1.5")
everything else (null, boolean, object, array, bigint) is INVALID_QUANTITY. A bigint cannot arrive from JSON, so accepting one would hide a bug
result <= 0 is INVALID_QUANTITY (the engine also rejects zero; this is defense in depth)
result > max is ABOVE_MAXIMUM
Strings are the safe path for large quantities, which is why the API contract allows "integers within the safe-integer range (or strings)".
5.3 Benchmark design (packages/benchmarks)
Goal: a baseline, not an optimization. Record numbers you can quote with hardware attached, and a measured confirmation of the O(n) level-insert claim.
Rules for honest micro-benchmarks:
Each iteration must start from the same book state. Either restore state in the task (place then cancel the same order) or build a fresh book per batch outside the timed region. A book that grows across iterations makes later iterations slower and the result meaningless.
Keep setup out of the timed function.
Warm up (tinybench's warmupTime), and run on a quiet machine (laptop plugged in, no other heavy processes). Note the hardware in the table.
Report ops/sec and the relative margin of error, not a single number.
#
Scenario
What it shows
B1
Rest a GTC order at a new best level (book has 10 levels), then cancel it
Level insertion at the cheap end
B2
Rest at an existing level (append), then cancel
O(1) append and unlink
B3
Match one incoming order against one resting order (re-seed the maker each iteration)
Core match cost
B4
Sweep 3 levels with one incoming order (re-seed)
Multi-level match
B5
Cancel head, middle, tail of a 100-order level
O(1) unlink claim
B6
IOC with no liquidity
The cheapest path, a floor for apply overhead
B7
Insert a new worst-priced level into books with 10, 100, 1,000 live levels
Measures the O(n) array shift; this is the evidence for "when would you switch to a tree"

Optional: run B3 once with node --cpu-prof and note the top three self-time functions (do not act on them yet; E3 is Week 11). Heap profiling (--heap-prof) is also deferred.
5.4 Optional stretch (only if Day 5 finishes early): amend
Blueprint lists amend (cancel-replace) under core features. If you have 2 spare hours:
AmendOrder { orderId, newPrice?, newQuantity }
price change: loses priority (cancel then re-place at the back of the queue, may match immediately)
quantity reduction only: keeps priority (mutate remaining and level.totalQty in place)
quantity increase: treated as a price-change (loses priority); document the choice
tests: amend to a crossing price trades; amend down keeps FIFO position; amend of an unknown or IOC id gives a reject
Otherwise move it to the Week 4 buffer. Do not let it delay section 8.

6. Worked examples (use as test fixtures)
Instrument: tick = 1, lot = 1. Every order here is IOC unless stated. Events are listed in the exact order they must appear.
Example 4: cap stops the sweep, remainder cancelled
Setup (GTC): SELL o1 @101 q2, SELL o2 @102 q2, SELL o3 @103 q2.
Command
Expected events
Book afterwards
BUY o4 @102 q5 IOC
Trade 2@101 (maker o1), Trade 2@102 (maker o2), OrderCancelled(o4, remaining 1, IOC_REMAINDER)
asks: 103 [o3:2]. Nothing at 103 traded; o4 is nowhere in the book

Example 5: no liquidity
Empty book.
Command
Expected events
Book afterwards
BUY o1 @100 q5 IOC
OrderCancelled(o1, remaining 5, IOC_REMAINDER)
empty
CANCEL o1
CancelRejected(UNKNOWN_ORDER)
empty

Contrast: the same order as GTC would produce OrderRested.
Example 6: sell floor
Setup (GTC): BUY o1 @100 q3, BUY o2 @99 q3, BUY o3 @98 q3.
Command
Expected events
Book afterwards
SELL o4 @99 q8 IOC
Trade 3@100 (maker o1), Trade 3@99 (maker o2), OrderCancelled(o4, remaining 2, IOC_REMAINDER)
bids: 98 [o3:3]

The floor is inclusive (99 trades) and 98 is not touched. Trades happen at resting prices (100 and 99), not at 99.
Example 7: huge cap sweeps everything, still trades at resting prices
Setup (GTC): SELL o1 @101 q1, SELL o2 @102 q1.
Command
Expected events
Book afterwards
BUY o3 @110 q5 IOC
Trade 1@101 (o1), Trade 1@102 (o2), OrderCancelled(o3, remaining 3, IOC_REMAINDER)
empty (both levels removed from maps and arrays)

Example 8: IOC partially consumes the head maker
Setup (GTC): SELL o1 @100 q10, SELL o2 @100 q10.
Command
Expected events
Book afterwards
BUY o3 @100 q4 IOC
Trade 4@100 (maker o1). No OrderCancelled (fully filled)
100 [o1:6, o2:10]; o1 still at head

Example 9: cap exactly one tick short
Setup (GTC): SELL o1 @101 q5.
Command
Expected events
Book afterwards
BUY o2 @100 q5 IOC
OrderCancelled(o2, remaining 5, IOC_REMAINDER)
asks: 101 [o1:5] unchanged
BUY o3 @101 q5 IOC
Trade 5@101 (maker o1)
empty


7. Edge cases to handle
IOC matching
IOC against an empty book: cancelled in full, no trades (U8)
IOC that does not cross (cap one tick below best ask): cancelled in full (Example 9)
IOC that exactly fills: trades only, no OrderCancelled event
IOC that partially fills: trades, then OrderCancelled with the unfilled remainder (U23)
IOC sweeping several levels and several orders per level, stopping at the cap (U9, Example 4)
IOC with a cap far beyond the book: trades at resting prices, whole book consumed, remainder cancelled (Example 7)
Cap and floor are inclusive; one tick worse is not touched (U26, Example 9)
SELL IOC is the exact mirror (U25, Example 6); write the BUY and SELL tests separately, not through one parameterized helper that hides a flipped operator
IOC partially consuming the head maker leaves that maker at the head (U30)
IOC consuming an entire level removes the level from the map and the price array and updates bestPrice() (U31)
IOC never appears in restingOrders(), depth() or orderIndex at any point (U10, P13)
IOC and identity
IOC reusing the id of a currently resting order: OrderRejected(DUPLICATE_ORDER_ID), the resting order is untouched (U28)
Cancel of an IOC order id afterwards: CancelRejected(UNKNOWN_ORDER) (U27)
The same IOC id reused later when nothing is resting under it: accepted. This is the Week 2 decision (the engine remembers only resting ids; the gateway, risk stage and input stage dedupe). Test it and comment why
Invalid IOC (tick, lot, bounds): OrderRejected, never OrderCancelled (U29)
Events
Event order within one command is deterministic: trades in match order, then the terminal event for the taker
OrderCancelled.reason is USER_REQUEST for CancelOrder and IOC_REMAINDER for IOC (U34)
remaining on OrderCancelled is the unfilled quantity, because a downstream reservation release depends on it
ts is echoed from the command, never read from a clock
Self-trade
IOC may trade against the same account's resting order (policy unchanged from Week 2: allowed). Add one test that documents it so a later policy change is a conscious diff
Edge input (common)
Number.MAX_SAFE_INTEGER accepted if <= max; 2**53 rejected as UNSAFE_INTEGER
9007199254740993 literal in source is already 9007199254740992 as a number, so the parser cannot know; the string form "9007199254740993" is accepted and is exact. Write a test that shows both, with a comment explaining why strings are the safe path
NaN, Infinity, -0, 1.5, negative, zero: INVALID_QUANTITY
Strings: leading zeros, whitespace, exponent, hex, sign, empty: all INVALID_QUANTITY
Above the configured maximum: ABOVE_MAXIMUM for both number and string input
Engine hygiene (carried over)
Capture next before unlinking while sweeping
No empty level left in the map or the array after an IOC sweep
Rejection leaves the book completely unchanged (compare restingOrders() before and after)
No number in money math; bigint only

8. Test cases to pass
IDs U8 to U10 and U12 come from blueprint 10.1. U22 to U34, EX1 to EX3, Q1 to Q8 and P12 to P14 are new; add them to the blueprint tables so the numbering stays shared.
8.1 Unit tests (engine)
#
Test
Expected
U8
IOC with cap, empty book
No trade, OrderCancelled(IOC_REMAINDER) with full quantity, book empty
U9
IOC with cap, cap reached mid-book (Example 4)
Remainder cancelled; no trade at a price above the cap; level beyond the cap untouched
U10
IOC remainder
Unfilled part cancelled, never rests, absent from restingOrders()
U12a
Quantity or price above the configured maximum (engine)
OrderRejected, book unchanged
U22
IOC exactly fills against one maker
One trade; no OrderRested, no OrderCancelled; maker level removed
U23
IOC partially fills, remainder cancelled
Trades then OrderCancelled with the exact remainder
U24
IOC does not cross (cap one tick short)
No trades, cancelled in full, book unchanged (Example 9)
U25
SELL IOC with a floor (Example 6)
Trades at resting prices at or above the floor; stops at the floor
U26
Cap equal to the level price trades; one tick worse does not
Inclusive boundary on both sides
U27
CancelOrder for an IOC id afterwards
CancelRejected(UNKNOWN_ORDER), book unchanged
U28
IOC with the id of a resting order
OrderRejected(DUPLICATE_ORDER_ID), resting order untouched
U29
IOC with a tick or lot violation
OrderRejected, no OrderCancelled, book unchanged
U30
IOC partially consumes the head maker (Example 8)
Maker stays at head with the right remaining
U31
IOC consumes a whole level
Level gone from map and prices array; best price updates
U32
IOC sweeps the whole book (Example 7)
Both sides' arrays empty; trades at resting prices
U33
IOC against own resting order
Trade happens (self-trade allowed); documents the policy
U34
Cancel reasons
CancelOrder gives USER_REQUEST; IOC remainder gives IOC_REMAINDER

Run checkInvariants() after every command in every test above and fail with the list of violations.
8.2 Carry-over exact-event tests
#
Test
Expected
EX1
Example 1, steps 1 to 8
Exact event array and exact book after each step
EX2
Example 2 (FIFO with a partially filled maker)
Exact events and book after each step
EX3
Example 3 (cancel head, middle, tail in three runs)
Remaining orders still match in arrival order; invariants clean

8.3 Edge-parser tests (common)
#
Test
Expected
Q1
Valid small integers as number and as string
ok, correct bigint
Q2
Number.MAX_SAFE_INTEGER (if within max)
ok, exact
Q3
2**53, 2**60 as numbers
UNSAFE_INTEGER
Q4
"9007199254740993" as a string
ok, exactly 9007199254740993n
Q5
NaN, Infinity, 1.5, -1, 0, -0
INVALID_QUANTITY
Q6
"1e3", "0x10", "007", " 5", "", "+5", "1.0"
INVALID_QUANTITY
Q7
null, true, {}, [], a bigint
INVALID_QUANTITY
Q8
Value above max (number and string)
ABOVE_MAXIMUM. Property version: for any bigint in [1, max], string and (if safe) number forms parse to the same value

8.4 Property and differential tests (fast-check)
Use at least 5,000 runs, sequences up to about 300 commands, and a mix of GTC and IOC. Run checkInvariants() after every command. Print the seed on failure and copy it into PROGRESS.md.
#
Property
P1
The book is never crossed after any command (now with IOC in the mix)
P2
Per run, total quantity filled on buy orders equals total quantity filled on sell orders. Compute each side's total independently from per-order fills in event-analysis.ts, not by summing trade quantity twice
P3
No order is ever filled for more than its quantity; every trade quantity is positive
P4
Time and price priority: for each command, makers at the same price appear in strictly increasing arrival order; across prices, a BUY taker's trade prices never decrease and a SELL taker's never increase
P11
After every command each prices array is strictly ordered, has no duplicates, and equals exactly the set of non-empty levels
P12 (new)
Conservation: for every order, filled + cancelled + resting remaining == quantity (rejected orders count as zero everywhere)
P13 (new)
IOC: an IOC order never rests and never appears in restingOrders(); every trade it takes part in is at a price within its cap or floor
P14 (new)
Determinism: two fresh books fed the same sequence produce deep-equal events and identical restingOrders() (the property form of U21, and the seed of P7 in Week 5)
D1
Engine vs reference matcher: identical event streams and identical final resting orders, with IOC, across several instrument specs (for example tick 1 lot 1, tick 5 lot 10)

Generator guidance (extends Week 2):
Keep prices in a narrow band (95 to 105 ticks) and quantities small (1 to 20 lots) so orders cross and partial fills are common
Choose time in force with a weighted arbitrary (about 70% GTC, 30% IOC)
Generate occasional invalid orders (off-tick, off-lot, zero, above max) and cancels of unknown ids, so rejection paths run too
Draw the InstrumentSpec per run (small set of specs), and generate prices and quantities as multiples of that spec most of the time
Assign ids by command index (o0, o1, ...). Sometimes reuse an earlier id to hit DUPLICATE_ORDER_ID
Add a few hard-coded regression examples (and seeds of any past failures) so fixed bugs stay fixed
Reference matcher with IOC (must remain a different algorithm): a plain array of resting orders. For each incoming order, filter the opposite side to orders that satisfy the limit, sort by (better price first, lower arrival index), and consume. If anything remains: GTC pushes it onto the array, IOC emits OrderCancelled. Do not reuse any engine code, comparators or structures.
8.5 Benchmarks (not pass/fail, but must run)
B1 to B7 from section 5.3 run via npm run bench, and the results table (ops/sec, margin, hardware, Node version, date) is committed to docs/experiments.md as the E3 baseline, with a line stating what it does not prove (no allocation data, no tail latency, no Kafka or Postgres, single laptop).

9. Rules for this week
engine-core must not import anything (including node:*), use async/await or Promises, read Date or performance, call Math.random, use process, timers or fetch, use number for money, or key anything by a plain object. Do not weaken the ESLint rules.
Tests, benchmarks and generators live outside engine-core/src, so they may use anything.
AI tools this week. Allowed: scaffolding test files from the worked examples, drafting the tinybench harness, brainstorming extra edge cases, reviewing your complexity claims, explaining errors, writing the PROGRESS.md entry. Not allowed: the IOC branch in apply and the reference matcher. You defend those line by line.
Limit-hit protocol: commit after every green test; leave PROGRESS.md stating what is done and the next failing test.
Every Codex or AI diff gets reviewed against the dependency map. If you cannot explain a file, simplify it.
If a blueprint statement conflicts with what the tests show, the tests win. Log it under "Decisions and deviations".

10. Decisions to record in docs/decisions.md this week
Use the format: context, options, choice, trade-offs, how tested.
IOC price semantics. One price field: limit for GTC, hard cap/floor for IOC. Options: a separate priceCap field, or a MARKET order type in the engine. Chosen so that market orders stay a risk-stage concept (converted to capped IOC, blueprint 5.9) and the engine has one matching path. Tested by U9, U25, U26, P13.
IOC remainder is an event, not silence. OrderCancelled with IOC_REMAINDER and the remaining quantity, because the risk stage releases reservations from it. Tested by U8, U23, U34.
IOC never touches orderIndex or any level. Consequence: cancel of an IOC id is UNKNOWN_ORDER. Tested by U10, U27, P13.
Cap and floor are inclusive. Matches the GTC crossing rule (a buy and a sell at the same price match). Tested by U26.
Order-id reuse after an IOC. The engine remembers only resting ids (Week 2 decision); global dedupe belongs to the gateway, risk stage and input stage. Tested and commented in U28 and the reuse test.
Self-trade stays allowed (unchanged), now also for IOC. Revisit only as a stretch feature. Tested by U33.
Edge parser in common, plain TypeScript, strings are the safe path for large quantities. Why it is separate from engine validation: the engine only sees bigint, but by the time JSON has produced a number beyond 2^53 the information is already lost. Tested by Q1 to Q8.
Differential plus property testing. D1 against an independent reference, P2 to P4 and P12 to P13 against rules derived from the commands. Why both: a reference can share a misunderstanding with the engine, while command-derived properties cannot.
Benchmarks: baseline only this week. No optimization before measurement. The E3 table starts here so Week 11 has a "before".
Also update the complexity table from Week 2 with your actual B7 numbers: at what level count does the O(n) array shift start to matter, and what would you switch to?

11. Interview prep for this week
Be able to answer from memory:
What is an IOC order, and what happens to its unfilled part? Why must it never rest?
Why is the IOC limit just the order's price rather than a separate cap field? How does a market order fit in later?
Why does an IOC buy trade at resting prices even when its cap is much higher? (The cap bounds the worst price, not the price paid. That is also why a reservation of cap x quantity is a safe upper bound in the risk stage.)
What does OrderCancelled(IOC_REMAINDER, remaining) let the risk stage do?
Why test against a reference matcher, and why must it be a different algorithm?
What does property P12 (conservation) catch that P3 does not?
Why does the edge parser reject a number above 2^53 instead of converting it?
What did your benchmark show about level insertion at 10, 100 and 1,000 levels, and what would make you replace the sorted array?
Whiteboard exercise (no notes): draw the book after Example 4's setup (asks 101, 102, 103). Execute BUY o4 @102 q5 IOC: show levels, the prices array, list pointers and orderIndex after each trade, say which trade removes which level, and show exactly where the remainder goes (nowhere in the structures; only an event).

12. Common mistakes to avoid
Resting the IOC remainder "for just a moment" or adding the IOC order to orderIndex
Emitting OrderCancelled for an IOC that was rejected by validation (it should be OrderRejected)
Emitting the cancel event before the trades
Cap and floor comparison flipped for SELL (write satisfiesLimit(side, limit, best) once and test both sides)
Making the match loop depend on timeInForce; only the tail should differ
Reference matcher copying engine code or the same comparator (D1 becomes circular)
Generators that produce almost only GTC, or prices so spread out nothing ever crosses
Summing trades twice and calling it P2; derive each side's fills from per-order data
Benchmarking a book that grows across iterations, or timing the setup
Reading a benchmark from a laptop on battery, or comparing numbers across different machines
"Optimizing" after the first profile. This week records a baseline; it does not change code
Using a number for the edge-parser result or for any money field

13. Progress log (copy into PROGRESS.md each day)
Day N:
- Done:
- Failing / blocked:
- Next failing test to write:
- Property-test seeds worth keeping:
- Decisions made:
- Benchmark notes (hardware, Node version):


14. Week 4 preview (not this week)
Week 4 wraps the finished core in the shard runner's input stage: a bounded command queue in, an event list out, ts = max(lastTs, Date.now()) stamping (blueprint 5.8), and a deliberately naive concurrent-async risk version for comparison. You will write concurrency tests C2, C3, C5, C6 and the end-to-end benchmark F3 (single-writer vs naive-async), and record decision #1.
What Week 3 must hand over: a stable apply(command): Event[] contract, deterministic events (P14), a baseline benchmark table, and a clean test suite that Week 5's replay test (P7) can reuse.

