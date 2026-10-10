# MatchLedger: Week 2 Plan (Order Book and Matching Core)

Source of truth: `docs/BLUEPRINT.md` sections 5.3, 5.8, 9.1, 10.1, 10.2 and 15 (Weeks 2 to 3). Budget: 12 to 15 hours. All work is inside `packages/engine-core`. **No Docker, Kafka, Postgres or I/O this week.** Week 1's CI job proves the live spikes in parallel; do not wait for it.

## 1. Goal and definition of done

**Goal:** a correct, deterministic, zero-dependency matching core with price-time priority, supporting LIMIT, IOC (with price cap) and CANCEL, with strong unit and property tests.

**Done when:**
- [ ] `npm run build`, `lint` (purity rules), `check:boundaries`, `test` all pass; `engine-core` still has an empty `dependencies` object
- [ ] Unit tests U1 to U12 and U15 pass (U13 and U14 are Week 7: they belong to the risk stage)
- [ ] Property tests P1 to P4 and P11 pass over thousands of random sequences, with the seed printed on failure
- [ ] Same command sequence run twice gives byte-identical events (determinism test)
- [ ] You can state the complexity of add, best price, match and cancel, and walk an order that sweeps two levels on a whiteboard

## 2. Scope

**In:** order types LIMIT and IOC, CANCEL command, validation (tick, lot, positive, maximum), price-time priority, partial fills, multi-level sweeps, deterministic ids and sequence numbers, a reference model for tests.

**Out (later weeks):** MARKET orders (the risk stage converts them to capped IOC, Week 7), amend (Week 8 or later), the breaker (Week 8), `Tick` handling beyond accepting the command type, reservations, journal, anything async.

## 3. Technologies

| Area | Choice | Note |
|---|---|---|
| Language | TypeScript 6.0.x strict | `bigint` for price and quantity, never `number` |
| Data structures | `Map`, sorted `bigint[]`, doubly linked list | Never plain `{}` for price-keyed maps |
| Tests | Vitest 4.1.x, fast-check 4.x (`@fast-check/vitest` if useful) | Generators live in test files only |
| Lint | ESLint purity rules from Week 1 | Must keep passing on `engine-core/src` |
| Dependencies | none at runtime | Dev deps only |

## 4. Design

### 4.1 Types (`src/matching`)

```
Side            = 'BUY' | 'SELL'
OrderType       = 'LIMIT' | 'IOC'
InstrumentConfig = { symbol, tickSize: bigint, lotSize: bigint,
                     maxQuantity: bigint, maxPrice: bigint }   // passed in, never read from env

Command  = PlaceOrder { ts, orderId, accountId, side, type, price: bigint, quantity: bigint }
         | CancelOrder { ts, orderId }
         | Tick { ts }                      // accepted, no-op this week

Event    = OrderAccepted { engineSeq, orderId, ... }
         | OrderRested   { engineSeq, orderId, price, remaining }
         | TradeExecuted { engineSeq, tradeId, price, quantity,
                           takerOrderId, makerOrderId, takerSide, takerAccountId, makerAccountId }
         | OrderCancelled{ engineSeq, orderId, remaining, reason }   // CANCEL_REQUEST | IOC_REMAINDER
         | OrderRejected { engineSeq, orderId, reason }
         | CancelRejected{ engineSeq, orderId, reason }
```

Rules:
- Prices are integer **ticks**, quantities integer **lots** (`bigint`). The engine validates `price % tickSize == 0` and `quantity % lotSize == 0` using config values.
- `ts` and `orderId` are inputs. The engine never creates ids from clock or randomness.
- `engineSeq` is a per-engine monotonically increasing `bigint` counter in engine state. It orders events and breaks same-price arrival ties. `tradeId` = `<symbol>-T<n>` from a second internal counter.
- Reject reasons (stable string codes): `INVALID_PRICE`, `INVALID_QUANTITY`, `INVALID_TICK`, `INVALID_LOT`, `EXCEEDS_MAX_QUANTITY`, `EXCEEDS_MAX_PRICE`, `DUPLICATE_ORDER_ID`; cancel reject: `ORDER_NOT_RESTING` (covers filled, cancelled and never existed: decision recorded in `docs/decisions.md`).

### 4.2 Engine API

```
class Engine {
  constructor(config: InstrumentConfig)
  apply(cmd: Command): Event[]      // synchronous; the only mutator
  snapshotView(): BookView          // read-only, deterministic, for tests
}
```
Conceptually `(state, command) -> (state, events)`. State mutates in place for speed; the contract is determinism: same state plus same command gives same events.

### 4.3 Book structure (`src/book`)

- Each side: `Map<bigint, PriceLevel>` plus a sorted `bigint[]` of active prices with **best price as the last element**. Bids ascending (best = highest = last). Asks descending (best = lowest = last).
- `PriceLevel`: doubly linked list of order nodes (head = oldest) plus `totalQuantity`.
- `Map<OrderId, OrderNode>` for O(1) cancel with unlink. Emptying a level removes the price from the array.
- Complexity: best price O(1); add to existing level O(1); new level O(log n) find plus O(n) shift; cancel O(1) plus O(n) only when it empties a level.

### 4.4 Matching algorithm (`apply(PlaceOrder)`)

1. Validate (order of checks fixed and documented): duplicate id, quantity > 0, price > 0, tick, lot, maximums. On failure emit `OrderRejected` and **change no state**.
2. Emit `OrderAccepted`.
3. While incoming has remaining quantity and the opposite side is non-empty and the best opposite price **crosses** (buy: `bestAsk <= price`; sell: `bestBid >= price`):
   - take the head order of the best level;
   - `fill = min(incoming.remaining, maker.remaining)`;
   - trade price = **maker's price**; emit `TradeExecuted`;
   - reduce both; if maker is empty, unlink it and drop the level if empty; a partially filled maker **keeps its queue position**.
4. If remaining > 0: LIMIT rests (`OrderRested`, appended at the **tail** of its level); IOC emits `OrderCancelled { reason: IOC_REMAINDER }` and never rests. For IOC the order `price` acts as the hard price cap.
5. Fills never exceed either order's quantity, and no fill trades at a price worse than the taker's limit.

`apply(CancelOrder)`: if the id is resting, unlink it and emit `OrderCancelled { reason: CANCEL_REQUEST }`; otherwise `CancelRejected { ORDER_NOT_RESTING }` with no state change.

Self-trade policy for now: **allowed**, documented in `decisions.md` (prevention is a stretch feature).

## 5. Schedule (about 13 hours)

| Day | Hours | Work | Prompt |
|---|---|---|---|
| 1 | 1 | Read this plan and blueprint 5.3. Whiteboard a sweep across two levels | none |
| 2 | 3 | Types, `OrderBook`, price-array operations, U6, U15, P11 | Prompt 6 (already given) |
| 3 | 3 | Validation and LIMIT matching, U1 to U5, U11, U12 | Prompt 7 |
| 4 | 2.5 | IOC with cap, cancel, U7 to U10 | Prompt 8 |
| 5 | 3 | Reference model, property tests P1 to P4, determinism test, edge-case tests | Prompt 9 |
| 6 | 1.5 | Review: read diffs, benchmark smoke, docs, tick the checklist | Prompt 10 |

## 6. Test cases to pass

### Unit tests

| # | Test | Expected |
|---|---|---|
| U1 | Buy matches sell at same price | One trade; both filled; book empty |
| U2 | Buy crosses lower ask | Trade at the ask price |
| U3 | Large buy sweeps three levels | Trades in price order at each level's price |
| U4 | Two asks at same price | Earlier arrival fills first |
| U5 | Partial fill of resting order | Resting order keeps its queue position |
| U6 | Cancel resting order | Removed, no longer matchable, O(1) map lookup |
| U7 | Cancel unknown or filled order | `CancelRejected`, no state change |
| U8 | IOC with cap, empty book | No trade; `OrderCancelled IOC_REMAINDER` for full quantity |
| U9 | IOC cap reached | Remainder cancelled; no trade above cap |
| U10 | IOC remainder | Unfilled part cancelled; never rests |
| U11 | Tick or lot violation | `OrderRejected`; state unchanged |
| U12 | Quantity or price above maximum, zero, negative | `OrderRejected`; state unchanged |
| U15 | New level inserted at best, middle, worst | Array stays ordered; best is last element |

### Property tests (fast-check, thousands of random sequences)

| # | Property |
|---|---|
| P1 | Book is never crossed (best bid < best ask) after any command |
| P2 | Total quantity bought in trades equals total sold |
| P3 | No order is filled for more than its quantity; remaining never negative |
| P4 | Within a price level, fills respect arrival order |
| P11 | Price array strictly ordered and contains exactly the levels with resting orders |
| Extra | **Determinism:** same command list applied to two fresh engines gives identical events and identical `snapshotView()` |
| Extra | **Model equivalence:** engine output equals a slow, obviously-correct reference model (sorted array re-sort on every command) on random sequences |
| Extra | **Rejections don't mutate:** a rejected command leaves `snapshotView()` unchanged |

## 7. Edge cases to cover (blueprint 9.1)

| Case | Expected behavior |
|---|---|
| Sweep several levels and several orders per level | Price order, then arrival order |
| Partial fill leaves remainder resting | Remainder rests at tail of its level |
| Same price, same instant | `engineSeq` decides, deterministically |
| IOC with cap, no liquidity | Cancelled in full, nothing rests |
| IOC sweeping whole book | Cap stops the sweep |
| Limit priced through the market | Executes at resting price, not its own |
| Cancel filled, cancelled or never-existed order | `ORDER_NOT_RESTING` |
| Duplicate `orderId` | `DUPLICATE_ORDER_ID`, no state change |
| Zero, negative, off-tick, off-lot, above maximum | Rejected with the specific reason |
| Very large `bigint` values | No precision loss; maximums enforced |
| Same account on both sides | Allowed this week (policy in decisions.md) |
| `Tick` command | Accepted, no events, no state change |
| Empty book | Limit rests; IOC cancels |
| Many orders at one price then cancel the middle one | Neighbors relinked; order preserved |

## 8. Traps

- Using a plain object for price levels: keys reorder. Use `Map`.
- Comparing prices as numbers or strings: compare `bigint`s with `<`, `>`; never mix `number` and `bigint`.
- Binary search off by one at the ends: P11 and U15 exist for this.
- Forgetting to remove a price from the array when a level empties (ghost levels): P11 catches it.
- Letting a rejected command partially change state: validate everything first, then mutate.
- Using `Date`, `Math.random`, `Promise` or `await` to "just generate an id": the lint rules will fail; ids are inputs or deterministic counters.
- Exporting mutable internals: expose a read-only view for tests, not the live structures.

## 9. Working rules

- Tests first for each behavior, or in the same commit.
- After every prompt: build, lint, check:boundaries, test, then update `PROGRESS.md`.
- Record design decisions as you go in `docs/decisions.md` (#2 data structure choice, plus the cancel-reason and self-trade decisions).
- If you cannot explain a function line by line, simplify it.

## 10. Codex prompts (Prompt 6 is already given: types and book structure)

### Prompt 7: validation and LIMIT matching

```
Continue from PROGRESS.md. Step 7. Work only in packages/engine-core. Read docs/week2-plan.md sections 4 and 7 first. Obey every purity rule: no async, no Date, no Math.random, no node: imports, no runtime dependencies, bigint for price and quantity, Map never plain objects.

1. Implement InstrumentConfig, the Command and Event types as specified in the plan (add engineSeq to every event; tradeId from an internal counter, format "<symbol>-T<n>").
2. Implement class Engine with apply(cmd): Event[] and snapshotView(). Implement PlaceOrder for type LIMIT only: validation first in this fixed order (duplicate order id, quantity > 0, price > 0, tick, lot, max quantity, max price), rejected orders change no state; then OrderAccepted; then the matching loop (cross test, trade at maker price, partial fills keep queue position, fully filled makers are unlinked and empty levels removed); then rest the remainder at the tail of its level with OrderRested. Tick commands are accepted and do nothing.
3. Tests (Vitest): U1, U2, U3, U4, U5, U11, U12 plus: duplicate order id, rejected command leaves snapshotView unchanged, sweeping several orders at one level in arrival order, limit priced through the market trades at the resting price.
4. Record the cancel-reason and self-trade decisions in docs/decisions.md. Add a short matching-loop description to docs/architecture.md.
5. Run build, lint (purity must pass), check:boundaries and test. Update PROGRESS.md.
```

### Prompt 8: IOC with cap and cancel

```
Continue from PROGRESS.md. Step 8. Work only in packages/engine-core, same purity rules.

1. Add IOC: the order price is a hard cap (same crossing rule as LIMIT); fill what crosses, then emit OrderCancelled with reason IOC_REMAINDER for any remainder; an IOC never rests and never trades above the cap (buy) or below it (sell).
2. Add CancelOrder: if the order id is resting, unlink via the id map in O(1) (remove the price from the array if its level empties) and emit OrderCancelled with reason CANCEL_REQUEST; otherwise emit CancelRejected with reason ORDER_NOT_RESTING and change no state.
3. Tests: U6, U7, U8, U9, U10, plus: cancel the middle order of three at one level and confirm neighbors keep order, cancel the only order at a level removes the level, IOC that fully fills emits no cancel, IOC sweeping the book stops at the cap.
4. Run build, lint, check:boundaries and test. Update PROGRESS.md.
```

### Prompt 9: reference model and property tests

```
Continue from PROGRESS.md. Step 9. Test code only, plus tiny test helpers; do not change engine behavior unless a test exposes a real bug (if so, fix it and say so in PROGRESS.md).

1. Write a slow reference model in the test folder (plain arrays, re-sort on every command, obviously correct, no shared code with the engine's book).
2. fast-check generators for random command sequences over a small price range and quantity range so that crossing and cancels are frequent (include invalid commands, cancels of unknown ids, duplicate ids). Generators are test-only; never use randomness inside src.
3. Properties, each with at least 2000 runs and the seed printed on failure: P1 book never crossed, P2 bought quantity equals sold quantity, P3 no order filled beyond its quantity, P4 fills within a level respect arrival order, P11 price array strictly ordered and exactly the non-empty levels (use snapshotView), determinism (two fresh engines give identical events and views), model equivalence (engine events equal reference model events), rejected commands never change the view.
4. If a property fails, shrink and paste the minimal counterexample into PROGRESS.md, fix the engine, and add that case as a permanent regression unit test.
5. Run build, lint, check:boundaries and test. Update PROGRESS.md with run counts and seed policy.
```

### Prompt 10: review pass and benchmark smoke

```
Continue from PROGRESS.md. Step 10, review. 
1. Add a tinybench file in packages/benchmarks: add resting order, match one order against one level, cancel; run it and record ops/sec and the machine in docs/experiments.md under "E3 baseline (Week 2)". No optimization yet.
2. Re-read packages/engine-core/src for: any plain-object maps keyed by price, any number/bigint mixing, any exported mutable internals, any TODO. Fix what you find and list it.
3. Update docs/architecture.md with the final book structure diagram (text or mermaid) and complexity table. Update docs/decisions.md #2 with options considered (tree, skip list, sorted array) and why the sorted array was chosen.
4. Run build, lint, check:boundaries, test. Update PROGRESS.md and print the test counts per file.
```

## 11. Friday review checklist

- [ ] Section 1 "Done when" ticked
- [ ] U1 to U12, U15, P1 to P4, P11 plus extras all green
- [ ] Property test seeds and run counts recorded in `PROGRESS.md`
- [ ] `docs/decisions.md` has #2 and the cancel and self-trade decisions
- [ ] Benchmark baseline recorded with machine details
- [ ] CI green (both jobs, including Week 1 integration)
- [ ] Whiteboard: book structure, a sweep across two levels, cancel in the middle of a level
- [ ] Can answer: why sorted array not a tree, why trade price is the maker's, why rejected commands must not mutate state