# MatchLedger status report (abbreviated audit)

Scope note: run under a ~2% token budget. Only items with evidence below are marked verified; everything else is UNVERIFIED / NOT RUN.

## 0 Summary
- Week 1 tooling and Weeks 2-3 engine are implemented. Build, lint, check:boundaries pass; `npm test`: 9 files passed, 2 skipped; 37 tests passed, 4 skipped; 10.15 s.
- engine-core exists (book, matching, 5 src files ~420 lines; breaker is a 1-line stub). Property test: 2,000 runs, default seed 20261009 (override ENGINE_PROPERTY_SEED), sequences up to 80 commands.
- Top problems:
  1. RISK: `npm ci --dry-run` prints an allow-scripts warning for @confluentinc/kafka-javascript (node-gyp rebuild); the CI integration job may fail to get its native binary. UNVERIFIED in CI.
  2. RISK: skipped tests (4) only run with RUN_CONTAINERS / RUN_INTEGRATION / RUN_REDIS_SPIKE / RUN_KAFKA_SPIKE = 1; they were NOT RUN here (no docker).
  3. RISK: check-boundaries.mjs allows `ws` in api (not in blueprint 4.4) and does not check devDependencies. Journal/projections spike tests are one-line minified code.
  4. DOC: docs/api.md and docs/openapi.yaml vs code NOT COMPARED. The api package implements only /health, /protected and /ws (packages/api/src/index.ts:18,22,36); all other documented endpoints are MISSING (expected for Week 1).
  5. DOC: .gitattributes is missing; docs suspicions 1-6 not checked (UNVERIFIED).
- Week 4 readiness: engine appears ready; confirm the unchecked items in section 10 first.

## 1 Command results
node v24.18.0; npm 11.16.0. build, lint: no errors. check:boundaries: "Dependency boundaries verified for all workspaces." test: see above. git status/log, npm ls: NOT RUN.

## 2 Inventory (src lines)
| package | files/lines | class |
|---|---|---|
| engine-core | book 3 files (130+89+59) + matching (207 engine, 134 types) + 4 test files | real implementation |
| common | money.ts 4 lines | spike |
| journal | spike7.test.ts 62, postgres.integration.test.ts 4 | spike |
| projections | index.ts 25 (Redis helper) + test 40 | spike |
| shard | spike4.ts 11 + test 2 | spike |
| api | index.ts 70 + test 92 | spike |
| benchmarks | engine.bench.ts 65, hello.bench.ts 2 | spike |
| ledger, recon, risk, simulator | 2 lines each | empty shell |
| web | not inspected | UNVERIFIED |

## 3 Engine
3.1 Types (types.ts): Side BUY|SELL; OrderType LIMIT|IOC; InstrumentConfig {symbol, tickSize, lotSize, maxQuantity, maxPrice} (bigint). Commands: PLACE{ts,orderId,accountId,side,orderType,price,quantity}, CANCEL{ts,orderId}, TICK{ts}. Events: ORDER_ACCEPTED, ORDER_RESTED{remaining}, TRADE_EXECUTED{tradeId,symbol,price,quantity,taker/maker ids+accounts,takerSide}, ORDER_CANCELLED{remaining,reason}, ORDER_REJECTED{reason}, CANCEL_REJECTED{reason}; all carry engineSeq, ts. RejectReason order in code (engine.ts:171-189): DUPLICATE_ORDER_ID, INVALID_QUANTITY, INVALID_PRICE, INVALID_TICK, INVALID_LOT, EXCEEDS_MAX_QUANTITY, EXCEEDS_MAX_PRICE: matches the design. CancelReason CANCEL_REQUEST|IOC_REMAINDER. engineSeq starts 1n, +1 per emit (engine.ts:17,195-196). Diff vs week2-plan.md: NOT RUN. BookView/LevelView only partly read.
3.2-3.5 Matching loop, event sequences, per-property verdicts, complexity: UNVERIFIED (not read in depth). Grep found no Date/Math.random/async/await in engine-core src (the grep that listed files returned none).
## 4 Tests
- Property tests: orderBook.test.ts (sorted-price/book, PROPERTY_RUNS), referenceModel.test.ts (2,000 runs, seed 20261009, maxLength 80, fails if interrupted or fewer runs). Whether the reference model shares code with the engine, whether generators emit invalid commands/duplicates: UNVERIFIED.
- Plan-id coverage matrix: UNVERIFIED.
- Skipped: journal postgres.integration (RUN_CONTAINERS), journal spike7 + projections (RUN_INTEGRATION/RUN_CONTAINERS, projections also RUN_REDIS_SPIKE), shard spike4 (RUN_KAFKA_SPIKE).
## 5 Endpoints
Code: GET /health, GET /protected (JWT), GET /ws (websocket). Everything in docs/api.md / openapi.yaml beyond that: MISSING. Agreement between the two docs: UNVERIFIED. Money codec: 4 lines, details UNVERIFIED.
## 6 Enforcement / infra
check-boundaries: checks dependencies, optional, peer (not devDependencies); forces engine-core deps = {}; allowed lists match blueprint 4.4 except extra `ws` in api. Also lists `redis` for projections, `pg` for journal. ESLint covering purity globs: UNVERIFIED (lint passes). docker-compose: no "latest" tag found. .nvmrc, .npmrc present; .gitattributes MISSING. ci.yml, tsconfig flags, lockfile vs package.json (dry-run printed only the allow-scripts warning, no ERESOLVE error shown in tail): partly verified.
## 7 Docs vs code
All sub-checks (test-plan DONE rows, PROGRESS claims, suspicions 1-6, formatting corruption): UNVERIFIED.
## 8 Plan status
Week 1: PARTIAL-to-DONE (tooling, boundary script, CI file exists, spikes exist; Day-1 items needing docker NOT RUN). Weeks 2-3: PARTIAL-to-DONE (engine + unit/property tests present; breaker stub only). Weeks 4-12: NOT STARTED (shells).
## 9 CI readiness
Verify job: likely passes (local build/lint/boundaries/test all green). Integration job: UNVERIFIED; main risks are the Kafka native build (node-gyp warning above), Kafka transaction startup race, and 60 s test timeouts.
## 10 Problems
- RISK: Kafka client install script blocked/needs approval (npm allow-scripts warning). Fix: run `npm approve-scripts` or confirm prebuilt binary in CI.
- RISK: `ws` not in blueprint allowed list for api. Fix: add to blueprint or remove.
- NIT: minified one-line tests in journal/shard. Fix: reformat.
- NIT: no .gitattributes. Fix: add `* text=auto eol=lf`.
## 11 Next actions
1. Re-run this audit's sections 3.2-3.4, 4, 5, 7 properly (needs ~10x the tokens). 2. Push and read CI result for the integration job. 3. Add .gitattributes. 4. Resolve `ws` vs blueprint. 5. Check docs/api.md for the "******" literal and trade id format.

---
# Addendum: previously UNVERIFIED sections (partial; read engine.ts, orderBook.ts, test names, eslint, ci.yml, grep of docs)

## 3.2 How it works (engine.ts, orderBook.ts)
- Book: per side `Map<bigint, PriceLevel>` + `SortedPrices(side)` (best = last element; bids asc, asks desc, sortedPrices.test.ts:5,14) + `Map<string, OrderNode>` id index (orderBook.ts:22). Engine keeps `acceptedOrderIds: Set<string>` (engine.ts:20).
- Validation (engine.ts:169-192): duplicate (set or book), qty>0, price>0, tick, lot, max qty, max price. Matches the design.
- Match loop (81-112): best opposite level head, fill = min(remaining, maker.remaining), trade price = maker.price, `reduceMaker`, then `book.cancel` when the maker hits 0. Loop ends at no cross. IOC remainder -> ORDER_CANCELLED(IOC_REMAINDER), else ORDER_RESTED.
- Counters: engineSeq (bigint, starts 1, every event incl. rejects, 195-196); tradeCounter is a `number` (18), tradeId `${symbol}-T${n}`; arrivalSeq bigint incremented only on accept (67).

## 3.3 Event sequences (from code)
| case | events |
|---|---|
| resting limit | ACCEPTED, RESTED |
| full cross | ACCEPTED, TRADE x n |
| partial cross then rest | ACCEPTED, TRADE x n, RESTED(remaining) |
| IOC remainder | ACCEPTED, TRADE x n, CANCELLED(IOC_REMAINDER, remaining) |
| IOC no liquidity | ACCEPTED, CANCELLED(IOC_REMAINDER, full qty) |
| IOC fully filled | ACCEPTED, TRADE x n (no cancel; test engine.test.ts:173) |
| cancel resting | CANCELLED(CANCEL_REQUEST, remaining) |
| cancel unknown/filled/cancelled | CANCEL_REJECTED(ORDER_NOT_RESTING) |
| any rejection | single ORDER_REJECTED(reason), no ACCEPTED |
| Tick | [] (no events, no seq change; engine.ts:48-50) |
Test-vs-code disagreement: not checked beyond test names; test names agree.

## 3.4 Verdicts
- Rejected commands mutate nothing: PASS (rejection returns before `acceptedOrderIds.add`, arrivalSeq, book; only engineSeq advances, as designed). Test engine.test.ts:66.
- No event before validation: PASS (engine.ts:53-63).
- Partial maker keeps position: PASS (reduceMaker mutates in place, no relink; test :54).
- Empty level + price removed: PASS (orderBook.ts:59-63; test :195).
- Cancel head/middle/tail/only: PARTIAL (middle tested :180, orderBook.test:42; only-node tested orderBook.test:33; head/tail via property test only; UNVERIFIED individually).
- number/bigint mixing: PASS for money; `tradeCounter` is a number (NIT, safe to 2^53).
- Purity: PASS (eslint rules cover Date, performance, process, timers, crypto, fetch, Math.random, await, async, Promise, non-relative imports, for engine-core src; lint passes).
- snapshotView exposes no mutable internals: PARTIAL (level orders are copied objects, orderBook.ts:121; `bidPrices` copy status UNVERIFIED).
- No internal ids/timestamps: PASS (ts from command, tradeId derived from counter; deterministic).
- IOC never rests: PASS (113-123). Trade price = maker: PASS (97). Fill <= both quantities: PASS (min(), 90).
- Self-trade: allowed, PASS (test :90).
- Same id twice: DUPLICATE_ORDER_ID, PASS (test :82, :205).

## 3.5 Complexity
add: O(log n) find + O(n) array shift (SortedPrices, not read), level append O(1); best O(1); match one maker O(1) (+ O(n) shift if a level empties); cancel O(1) unlink (+ O(n) if the level empties). docs/architecture.md claims: not compared.
RISK: `acceptedOrderIds` grows without bound (no pruning) and is not part of `snapshotView`, so it cannot be restored from a snapshot in Week 5.

## 4 Tests (names only; assertion depth NOT inspected)
- engine.test.ts (17 tests): U1 (:25), U2 (:34), U3 (:41), U4/U5 (:54), U11 and the check order (:66), duplicates (:82), self-trade (:90), tick (:98), U7 (:107), U6 (:123), U10 (:136), U9 (:145,159), IOC filled (:173), cancel middle (:180), empty level (:195), id reuse (:205).
- referenceModel.test.ts: P1+P11 (:264), P2 (:291), P3/P4 + seq/trade ids (:315), equivalence to a reference model (:367). Generators use fixed ids, accounts a0-a2, both sides, LIMIT+IOC, constantFrom price/qty, unknown-id cancels (:53); ticks/invalid prices depend on the constant lists (UNVERIFIED). Reference model is in the same test file, so does not import the book (UNVERIFIED fully).
- orderBook.test.ts: cancel/empty level, middle cancel, random add/cancel (P11-like, maxLength 100). sortedPrices.test.ts: U15 (2 tests, best at last).
| id | status |
|---|---|
| U1-U7, U9, U10, U11, U15 | COVERED (by name) |
| U8 | N/A engine-only (risk reservation) / NOT COVERED |
| U12 | PARTIAL (max qty/price in rejection test :66, UNVERIFIED) |
| P1-P4, P11 | COVERED |
Property settings: numRuns 2000, seed 20261009 or ENGINE_PROPERTY_SEED, test fails if interrupted or numRuns lower. Slow/failing tests: none (suite 10 s). E1-E7 mapping: only E3 (test-plan.md:118) checked.

## 5 Endpoints
Code-only: GET /health, GET /protected (Bearer JWT), GET /ws. Others MISSING. api.md vs openapi.yaml agreement: NOT RUN.

## 6 Infra
- eslint purity rules apply only to `packages/engine-core/src/**`; tests are exempt via `ignores`. Simulator is not targeted at all. Covers every listed API.
- ci.yml: jobs verify (npm ci, build, lint, boundaries, test) and integration (compose up postgres/redis/kafka, wait up to 90 s with pg_isready, redis ping, kafka-topics, then `npm test` with RUN_CONTAINERS/RUN_KAFKA_SPIKE/RUN_INTEGRATION=1). Note: prometheus/grafana not started; ok.
- Actions use `actions/checkout@v4`, `setup-node@v4` (pinned major only).

## 7 Docs vs code
- Suspicion 1 (trade id): CONFIRMED mixed. docs/api.md:13 says `trd_` prefix but its examples (:203,:350,:546) use `ACME-T1` (engine format). Fix: edit line 13.
- Suspicion 5: REFUTED at api.md:7 (`Authorization: Bearer <JWT>`); other occurrences not searched.
- Suspicion 6: test-plan "E3" = engine reject-no-mutation test (:118); experiments.md E3 not read. UNVERIFIED.
- Suspicions 2, 3, 4, PROGRESS.md claims, corruption search: grep for literal backtick-n found only line references in architecture-copilot-prompts.md (no corruption); rest NOT RUN.
- test-plan.md has 28 lines with DONE; mapping each DONE row to a test: NOT RUN.

## 9 CI readiness
Verify job: likely PASS. Integration job: risks (1) Kafka native binary / install script (npm allow-scripts warning), (2) `kafka-topics.sh` path `/opt/kafka/bin` in apache/kafka image is correct by convention (UNVERIFIED), (3) transaction coordinator may not be ready when spike4 starts (readiness only checks topic listing), (4) 60 s test timeouts. Lockfile: `npm ci --dry-run` showed no error in the output tail.

## 10 additional problems
- RISK: unbounded `acceptedOrderIds`, not snapshot-able.
- DOC: api.md:13 `trd_` vs `ACME-T1`.
- NIT: tradeCounter is `number`. (FIXED in addendum 2)

## Addendum 2: fixes and remaining checks
Fixed (build, lint, test still 37 pass / 4 skipped): `tradeCounter` is now bigint (engine.ts); added `Engine.seenOrderIds()` so a snapshot can persist the duplicate-id set (still unbounded: the RISK stays, pruning is a Week 5 decision); docs/api.md lines 11-13 no longer claim a `trd_` prefix; PROGRESS.md typo "lueprint.md" fixed.

New findings:
- BUG (CI): `@testcontainers/postgresql` is in no package.json and appears 0 times in package-lock.json, but `packages/journal/src/postgres.integration.test.ts` dynamically imports it when RUN_CONTAINERS=1, which ci.yml sets in the integration job. That job will fail at that test. Fix: add the exact-pinned devDependency to packages/journal and update the lockfile, or make the test use the compose Postgres.
- Property tests: generators DO emit invalid prices (0, -5, 7, 3000) and quantities (0, -10, 15, 5000), duplicate ids (6 fixed ids), unknown-id cancels, both sides, LIMIT and IOC (referenceModel.test.ts:30-55). The reference model is separate code, but the test reads the engine's private `book` (line 268) for invariant checks, so P1/P11 inspect the engine's structure, not the model's.
- docs/architecture.md:192-196 complexity table agrees with the code.
- Suspicion 6 REFUTED: experiments.md:5 says its benchmark is a smoke baseline, not the blueprint's E3.
- Suspicion 2 ("ticks"): only BLUEPRINT.md uses "ticks" in the docs searched, so REFUTED outside the blueprint.
- Suspicions 3 and 4 (week numbers, U3/U9/U10 quantities vs lot size): NOT RUN.
- api.md vs openapi.yaml: openapi has 45 path entries and api.md has 60 headings; no field-level comparison, NOT RUN.
