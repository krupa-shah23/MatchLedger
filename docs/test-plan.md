# MatchLedger test plan

This document is the executable test contract for later weeks. It is derived
from blueprint section 10 and [api.md](./api.md). A test is DONE only when the
corresponding test exists in this repository; otherwise it is PLANNED.

## 1. Strategy and execution policy

| Layer | Scope and tools | Where it runs |
| --- | --- | --- |
| Unit | Vitest 4; deterministic engine, codec, schemas, state machines | Every push, verify job |
| Property | fast-check 4; model comparison and invariants | Every push, verify job |
| Concurrency | Vitest plus controlled workers/queues and naive reference | Verify job; heavier cases nightly |
| Recovery/chaos | Vitest, child processes, Docker pause/kill hooks | Nightly/manual; integration job where containers are required |
| Risk/breaker | Vitest model/state-machine tests | Every push once implemented |
| Reconciliation | Vitest fixtures and API tests | Verify job and integration job |
| API/contract/security | Vitest, HTTP client, OpenAPI/schema assertions | Verify job; containers in integration job |
| WebSocket | Vitest/WebSocket client fixtures | Verify job and integration job |
| Integration | Testcontainers or compose in CI with Postgres/Kafka/Redis | Integration job |
| Performance | tinybench microbenchmarks and k6 HTTP/load tests | Nightly/manual; results committed to `docs/experiments.md` |

Every push runs the verify job (`build`, `lint`, boundaries, unit/property/API
tests). The integration job starts containers. Chaos and performance are
nightly or manual. CI uses fixed seed `20261009`; local runs may set
`ENGINE_PROPERTY_SEED` or the layer-specific seed. Every failure prints the
seed and the smallest fast-check counterexample. A flaky test is a bug in the
test or product: never retry-to-green.

## 2. Engine and domain tests

**Test config.** The default unit-test config is `tickSize=5n`, `lotSize=1n`, `maxQuantity=1000n`, and `maxPrice=2000n` (prices are minor units, so `10100n = 101.00`). U11 and the property tests use `lotSize=10n`; each row below states the config when it differs.

Package for U/P tests: `packages/engine-core`. Current tests are DONE only for
the cases already present in `src/**/*.test.ts`.

| ID | Setup (exact inputs) | Action | Expected result with concrete values | Package | Week | Automation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| U1 | Ask 100.00x10; buy 100.00x10 | Place buy | 1 trade 10@100.00; both filled; book empty | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U2 | Ask 100.00x10; buy 101.00x10 | Place buy | 1 trade at ask 100.00; book empty | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U3 | Asks 101.00x10, 101.05x10, 101.10x10; buy 101.10x25 (default config: lotSize=1n) | Place buy | 10@101.00, 10@101.05, 5@101.10; remainder 0 | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U4 | Asks 100.00x5 then 100.00x5 | Buy 100.00x6 | First ask fills 5, second fills 1 | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U5 | Ask A 100.00x10, ask B 100.00x10; buy 100.00x4 then buy 100.00x6 | Place both buys | A has 6 remaining and is filled before B | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U6 | Resting buy 100.00x10 | Cancel its ID | O(1) removal; no matchable order remains | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U7 | Empty book; cancel `unknown`, then cancel filled ID | Cancel commands | `CancelRejected(ORDER_NOT_RESTING)`; snapshots unchanged | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U8 | Empty book | IOC buy 101.00x10 | Accepted then cancelled with remaining 10; no resting IOC | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U9 | Asks 101.00x10, 101.05x10, 101.10x10 | IOC buy cap 101.05x25 (default config: lotSize=1n) | Trades 10@101.00 and 10@101.05; cancel remaining 5; no 101.10 trade | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U10 | Ask 100.00x4 | IOC buy 100.00x10 (default config: lotSize=1n) | Trade 4; cancel remainder 6; IOC never rests | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U11 | tickSize=5n, lotSize=10n | Submit price 101.03 and quantity 15 | `OrderRejected(INVALID_TICK)` then `INVALID_LOT` for independent IDs | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U12 | max quantity 1000, max price 2000 | Submit quantity 1001, price 2000.05, and unsafe edge quantity | Rejected at edge; no precision loss or state mutation | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| U13 | Static reference 100.00; no trades; one-sided market buy | Submit MARKET buy | Converts to capped IOC; reservation 100.00 x quantity | engine-core/risk | 4 | unit/CI | PLANNED |
| U14 | No trades, one-sided book, no reference price | Submit MARKET buy | `OrderRejected(NO_REFERENCE_PRICE)`; no reservation | engine-core/risk | 4 | unit/CI | PLANNED |
| U15 | Prices 100, 102, 101 on both sides | Insert each at best/middle/worst | Strictly sorted; best is last element | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/book/sortedPrices.test.ts` | DONE |
| P1 | Random valid/invalid command sequence, ts monotonic | Apply every command | If both sides exist, best bid < best ask after every command | engine-core | 2-3 | CI property; evidence: `packages/engine-core/src/matching/referenceModel.test.ts` | DONE |
| P2 | Random commands on one symbol | Sum trade quantities by taker side | Buy-side total equals sell-side total | engine-core | 2-3 | CI property; evidence: `packages/engine-core/src/matching/referenceModel.test.ts` | DONE |
| P3 | Random accepted LIMIT/IOC orders | Track accepted quantities and fills | Every order filled quantity <= accepted quantity; no negative remaining | engine-core | 2-3 | CI property; evidence: `packages/engine-core/src/matching/referenceModel.test.ts` | DONE |
| P4 | Multiple makers at one price | Apply random fills/cancels | Makers fill in increasing arrival sequence | engine-core | 2-3 | CI property; evidence: `packages/engine-core/src/matching/referenceModel.test.ts` | DONE |
| P5 | Accounts, ledger entries, fees | Apply random risk/ledger events | Total debits equal total credits after every sequence | common/ledger | 5-6 | CI property | PLANNED |
| P6 | Multi-account trades | Apply fills across symbols | Sum of positions per symbol is zero | risk/ledger | 5-6 | CI property | PLANNED |
| P7 | Stamped commands, snapshot, event journal | Replay from snapshot | Events and final live state are byte-for-byte equivalent | journal/engine | 5-6 | CI/integration | PLANNED |
| P8 | Same stamped log at different wall-clock times | Replay twice | Identical events/state; no hidden clock input | engine/journal | 5-6 | CI property | PLANNED |
| P9 | Market order with protection cap | Fill at prices within/outside cap | Total fill cost <= reservation | risk/engine | 5-6 | CI property | PLANNED |
| P10 | Bigints within codec bounds | Encode/decode through JSON, Postgres int8, Redis | JSON codec round trip is done; live Postgres/Redis round trip is pending CI | common | 1 | CI property; evidence: `packages/common/src/money.test.ts` | PARTIAL |
| P11 | Random adds/cancels on both sides | Inspect after every step | Arrays strictly ordered, exactly non-empty levels, best last | engine-core | 2-3 | CI property; evidence: `packages/engine-core/src/book/orderBook.test.ts` | DONE |
| C1 | One account, 3 symbols, hundreds of orders; demand > balance | Submit concurrently | Held <= balance and available >= 0 always | risk | 7 | CI | PLANNED |
| C2 | Same as C1 using await-between-read/reserve naive implementation | Submit concurrently | Naive version overspends; regression proof retained | risk | 4 | CI/manual | PLANNED |
| C3 | Many cancels/fills for one order in input queue | Race commands in arrival order | Exactly one deterministic outcome | engine/journal | 4 | CI | PLANNED |
| C4 | Same clientOrderId concurrently from one account | Publish duplicates | Exactly one order and original order ID | api/journal | 5-6 | integration | PLANNED |
| C5 | Many accounts submit to one symbol | Concurrent submissions | Fills equal matched volume; no lost/duplicate orders | engine | 4 | CI | PLANNED |
| C6 | Artificial delay at every risk await | Many messages for one account | One-at-a-time processing; results identical | risk | 4 | CI | PLANNED |
| R1 | Kill shard after N random events | Restart and replay | Recovered state equals uninterrupted run | journal | 5-6 | integration/manual | PLANNED |
| R2 | Kill during snapshot write | Restart | Previous valid snapshot used, then tail replayed | journal | 5-6 | integration | PLANNED |
| R3 | Duplicate every event delivery | Consume twice | State unchanged versus single delivery | projections | 5-6 | integration | PLANNED |
| R4 | Drop OrderAccepted after reservation | Wait sweeper window | Leaked reservation released | risk | 7 | integration | PLANNED |
| R5 | Restart consumer mid-batch/rebalance | Resume consumption | No lost or double-applied events | journal | 10 | integration | PLANNED |
| R6 | Snapshot tails 0, 1k, 10k, 100k events | Recover each | Recovery-time curve recorded | journal | 5-6 | manual/perf | PLANNED |
| R7 | Pause old shard past session timeout, resume after takeover | Write from frozen instance | Epoch rejects write; fail-stop; no sequence gap | journal | 10 | chaos/manual | PLANNED |
| R8 | Repeated rebalances under load | Consume commands | No duplicate/out-of-order commands; P5/P6 hold | journal | 10 | chaos | PLANNED |
| R9 | Kill gateway after Kafka publish before 202 | Retry same clientOrderId | One order; retry returns original ID | api | 10 | integration; unassigned in blueprint | PLANNED |
| R10 | Kafka unavailable | POST order | 503; never 202; no order exists | api | 10 | integration; unassigned in blueprint | PLANNED |
| R11 | Busy-loop shard beyond session timeout | Reassign then resume old process | Fenced fail-stop; no journal gaps | journal | 10 | chaos/manual | PLANNED |
| R12 | SIGTERM under load | Terminate and restart | Consumption stops, journal flushes, lease releases, clean resume | journal | 10 | chaos | PLANNED |
| K1 | Balance 100.00; order 100.00 then 100.05 | Submit two orders | First accepted; second rejected with exact reason | risk | 7 | CI | PLANNED |
| K2 | Reserve 105.00x10; fill at 100.00 | Partial fill with improvement | 50.00 excess reservation released | risk | 7 | CI | PLANNED |
| K3 | Insufficient balance snapshot `{available:10,required:100}` | Reject order | Event includes exact account snapshot | risk | 7 | CI | PLANNED |
| K4 | Trade returns crossing volatility threshold | Feed price series | CLOSED -> OPEN at expected trade/seq | breaker | 8 | CI | PLANNED |
| K5 | Open breaker; cooldown and stable trades | Advance time/input | OPEN -> HALF_OPEN -> CLOSED | breaker | 8 | CI | PLANNED |
| K6 | Half-open unstable burst | Feed burst | HALF_OPEN -> OPEN | breaker | 8 | CI | PLANNED |
| K7 | Breaker OPEN with resting order | Cancel it | Cancel accepted; reservation released | breaker/risk | 8 | CI | PLANNED |
| K8 | Alternating threshold-near prices | Feed flapping series | Hysteresis prevents rapid oscillation | breaker | 8 | property | PLANNED |
| K9 | Stamped breaker transition log | Replay at another wall time | Same transitions and sequence numbers | breaker/journal | 8 | CI property | PLANNED |
| K10 | Halt longer than maxHaltDuration | Advance stamped time | Resting orders force-cancel with `halt_timeout`; funds released | breaker/risk | 8 | integration | PLANNED |
| K11 | HALTED symbol | Submit new order | Early `symbol_halted`, no reservation | risk | 8 | CI | PLANNED |
| K12 | HALTED symbol with resting order | Trader cancels | Allowed; reservation released immediately | risk | 8 | CI | PLANNED |
| X1 | External CSV exactly equals internal trades | Upload | Zero breaks | recon | 8 | CI/integration | PLANNED |
| X2 | Internal trade absent externally | Upload | `MISSING_EXTERNAL` break | recon | 8 | CI | PLANNED |
| X3 | Same trade, price 101.25 vs 101.30 | Upload | PRICE_MISMATCH with both values | recon | 8 | CI | PLANNED |
| X4 | Duplicate external row | Upload | DUPLICATE break | recon | 8 | CI | PLANNED |
| X5 | Upload identical file hash twice | Upload twice | Existing run returned; no duplicate breaks | recon | 8 | CI | PLANNED |
| X6 | Open break | Resolve/write off with reason | Status/audit updated; adjustment creates ledger entry | recon | 8 | integration | PLANNED |
| F1 | Real engine add/match/cancel | Run tinybench | Ops/sec and allocation/heap result recorded | benchmarks | 2-3 | manual | PLANNED |
| F2 | One shard HTTP/order flow | k6 load | Throughput, p50/p95/p99, event-loop lag recorded | benchmarks | 11 | nightly/manual | PLANNED |
| F3 | Naive async vs serialized writer | Equal load | Throughput and C2 correctness compared | benchmarks | 4 | nightly/manual | PLANNED |
| F4 | 1, 2, 4 shards with CPU limits | k6/Kafka producer | Scaling curve plus hypothesis recorded | benchmarks | 11 | nightly/manual | PLANNED |
| F5 | Snapshot intervals 100, 1k, 10k | Recovery benchmark | Recovery-time curve recorded | benchmarks | 11 | nightly/manual; unassigned in blueprint | PLANNED |
| F6 | Slow WebSocket consumer | Stream book deltas | Engine latency unaffected; conflation/disconnect observed | api | 11 | nightly/manual | PLANNED |
| F7 | Bigint vs safe-number price index | Hot-path benchmark | Measured cost recorded; optional decision evidence | benchmarks | 11 | manual | PLANNED |

### Claimed DONE without evidence

- F1 ? no matching `packages/*/src/**/*.test.ts` or `test/` implementation file; the benchmark is not a test file.

## 3. Additional engine tests

| ID | Setup | Action | Expected result | Package | Week | Automation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | Two fresh engines | Apply identical command sequence | Events and snapshots deeply equal | engine-core | 2-3 | property; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| E2 | Independent array model and engine | Apply each generated command | Events/views equal after every command | engine-core | 2-3 | property; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| E3 | Resting book snapshot | Submit invalid command | Rejection event; snapshot deep-equal before/after | engine-core | 2-3 | property; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| E4 | Accepted commands and trades | Inspect all events | engineSeq is 1,2,3...; trade IDs are `ACME-T1`, `ACME-T2`... | engine-core | 2-3 | property; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| E5 | Filled order ID | Reuse ID | `DUPLICATE_ORDER_ID` | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| E6 | Cancelled order ID | Reuse ID | `DUPLICATE_ORDER_ID` | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |
| E7 | tick/lot/max values <=0 | Construct Engine | `RangeError` for each invalid config | engine-core | 2-3 | unit; evidence: `packages/engine-core/src/matching/engine.test.ts` | DONE |

## 4. API and contract matrix

The following matrix is generated from [api.md](./api.md). Every endpoint gets
the common security/money cases plus endpoint-specific validation. Each row's
request is exact enough to become a table-driven test. `M` means assert every
money/price field is a string and never a JSON number.

Common cases for every authenticated endpoint except login and register: missing token -> 401
`UNAUTHENTICATED`; expired token -> 401 same code; wrong role -> 403
`FORBIDDEN`; another trader's resource -> 404 `NOT_FOUND`; response has
`X-Request-Id`; 429 has `Retry-After`; 503 has `Retry-After`; M applies to
every response. These are included in each row below.

| ID | Endpoint and exact request | Expected cases/status/body |
| --- | --- | --- |
| AT-AUTH-1..6 | POST `/auth/login`, `{email:"a@example.com",password:"password1"}`; invalid email/password lengths | 200 token/user; 400 per email/password rule; 401 expired/bad credentials; 429; M; no mutation |
| AT-AUTH-7..10 | POST `/auth/register`, `{email:"new@example.com",password:"password1"}` and extra field | 201 TRADER/account/deposit; 400 field/unknown/password rules; 404 outside demo; 409 existing email; 429; idempotency is not promised |
| AT-AUTH-11..13 | POST `/auth/refresh`; GET `/me` | 200 login-shaped refresh and identity; 401 missing/expired; M not applicable; read-only |
| AT-ORD-1..8 | POST `/orders`, valid LIMIT `{clientOrderId:"c-1",symbol:"ACME",side:"BUY",type:"LIMIT",timeInForce:"GTC",quantity:10,price:"101.25"}` | 202 RECEIVED after durable publish; 400 unknown symbol, invalid side/type/TIF, missing/forbidden price, tick, lot, max, unsafe quantity; 401/403; 409 payload mismatch; 429; 503 publish failure; replay identical payload returns original ID; M |
| AT-ORD-9..12 | GET `/orders/ord_1`; GET `/orders?status=RESTING&symbol=ACME&limit=50&cursor=x` | 200 exact projection/pagination; 400 bad filters/limit/cursor; 401/403/404; M; read-only |
| AT-ORD-13..16 | DELETE `/orders/ord_1`; PATCH `/orders/ord_1` with `{quantity:5}` or `{price:"101.30"}` | 202 CANCEL_REQUESTED/AMEND_REQUESTED; 401/403/404; 409 terminal; 429; replay has one outcome; M |
| AT-ORD-17..19 | GET `/orders/ord_1/events` | 200 events/reservation movements/account snapshot; 401/403/404; M; read-only |
| AT-MKT-1..4 | GET `/instruments`; GET `/instruments/ACME` | 200 list/item; 401 missing/expired; 404 unknown symbol; M |
| AT-MKT-5..7 | GET `/symbols/ACME/book?depth=10`; invalid depth 0/51 | 200 best-first snapshot with seq; 400 each depth rule; 401/404; M |
| AT-MKT-8..10 | GET `/symbols/ACME/trades?limit=50`; invalid limit 0/201 | 200 trades; 400 each limit rule; 401/404; M |
| AT-MKT-11 | GET `/symbols/ACME/status` | 200 status; 401/404; M for none |
| AT-ACC-1..4 | GET `/accounts/acc_1/balances`, `/positions`, `/pnl` | 200 exact invariant/projection; 401 missing/expired; 403 wrong role; 404 other account; M |
| AT-ACC-5..7 | GET reservations with invalid status/limit/cursor; GET ledger with invalid dates/limit | 200 paginated items; 400 each query rule; 401/403/404; M |
| AT-RISK-1..4 | GET/PUT `/risk/accounts/acc_1/limits`, invalid negative/not-integer limits | GET 200; PUT 200 audited; 400 each rule; 401/403/404/409; idempotent same update; M |
| AT-RISK-5..6 | GET `/risk/rejections?reason=bad&limit=0`; GET `/risk/breakers` | 200 feeds; 400 invalid filter/limit; 401/403; M |
| AT-RISK-7..9 | POST halt/resume with `{reason:"manual halt"}`; invalid 4-char/missing reason | 202 command; 400 each reason rule; 401/403/404/409 already-state; 429; idempotent command outcome |
| AT-RISK-10 | PUT breaker config with `{windowTrades:5,volatilityThresholdBps:50,cooldownMs:1000,maxHaltDurationMs:60000}` | 200 echo; 400 each integer/minimum rule; 401/403/404; audited; M |
| AT-REC-1..5 | POST multipart `/recon/runs` valid CSV, malformed header/row, >20 MB; same file twice | 202 PROCESSING; 400 each CSV/file rule with row/line errors; 401/403/429/503; second upload 200 duplicate true; M |
| AT-REC-6..8 | GET runs; GET run; GET breaks with invalid filter; GET break | 200 exact run/break shapes; 400 filters; 401/403/404; M; read-only |

The grouped rows above expand to one case row for every endpoint as follows.
For each row, add the common missing-token/expired-token 401, wrong-role 403,
cross-trader resource 404, defined 409/429/503, idempotency replay where the
method is mutating, and money-as-decimal-string (`M`) assertions.

| ID | Exact endpoint | Happy request and expected success |
| --- | --- | --- |
| AT-E01 | POST `/auth/login` | `{email:"a@example.com",password:"password1"}` -> 200 token/user |
| AT-E02 | POST `/auth/register` | `{email:"new@example.com",password:"password1"}` -> 201 TRADER |
| AT-E03 | POST `/auth/refresh` | bearer token, no body -> 200 token |
| AT-E04 | GET `/me` | bearer token -> 200 identity |
| AT-E05 | POST `/orders` | valid LIMIT body with `quantity:10,price:"101.25"` -> 202 orderId/status; fills use trade id `ACME-T1` |
| AT-E06 | GET `/orders/{id}` | existing owned `ord_1` -> 200 order projection |
| AT-E07 | GET `/orders` | `status=RESTING&symbol=ACME&limit=50` -> 200 items/cursor |
| AT-E08 | DELETE `/orders/{id}` | owned resting `ord_1` -> 202 cancel request |
| AT-E09 | PATCH `/orders/{id}` | `{quantity:5}` -> 202 amend request |
| AT-E10 | GET `/orders/{id}/events` | owned `ord_1` -> 200 ordered events |
| AT-E11 | GET `/instruments` | bearer token -> 200 instrument list |
| AT-E12 | GET `/instruments/{symbol}` | `ACME` -> 200 instrument |
| AT-E13 | GET `/symbols/{symbol}/book` | `ACME?depth=10` -> 200 bids/asks/seq |
| AT-E14 | GET `/symbols/{symbol}/trades` | `ACME?limit=50` -> 200 trades/cursor |
| AT-E15 | GET `/symbols/{symbol}/status` | `ACME` -> 200 status/reason |
| AT-E16 | GET `/accounts/{id}/balances` | owned `acc_1` -> 200 balances |
| AT-E17 | GET `/accounts/{id}/positions` | owned `acc_1` -> 200 positions |
| AT-E18 | GET `/accounts/{id}/pnl` | owned `acc_1` -> 200 P&L |
| AT-E19 | GET `/accounts/{id}/reservations` | owned `acc_1` -> 200 reservations |
| AT-E20 | GET `/accounts/{id}/ledger` | owned `acc_1` -> 200 ledger entries |
| AT-E21 | GET `/risk/accounts/{id}/limits` | RISK account `acc_1` -> 200 limits |
| AT-E22 | PUT `/risk/accounts/{id}/limits` | `{maxOrderNotional:"100000.00",maxOpenOrders:100,maxPositionPerSymbol:"1000"}` -> 200 updated limits |
| AT-E23 | GET `/risk/rejections` | `reason=insufficient_balance&limit=50` -> 200 rejection list |
| AT-E24 | GET `/risk/breakers` | RISK -> 200 breaker states |
| AT-E25 | POST `/risk/symbols/{symbol}/halt` | `{reason:"manual halt"}` -> 202 `{status:"HALT_REQUESTED"}` |
| AT-E26 | POST `/risk/symbols/{symbol}/resume` | `{reason:"incident cleared"}` -> 202 `{status:"RESUME_REQUESTED"}` |
| AT-E27 | PUT `/risk/symbols/{symbol}/breaker-config` | valid integer config -> 200 config |
| AT-E28 | POST `/recon/runs` | multipart valid CSV -> 202 `runId` |
| AT-E29 | GET `/recon/runs` | OPS -> 200 runs/counts |
| AT-E30 | GET `/recon/runs/{id}` | OPS run `run_1` -> 200 run |
| AT-E31 | GET `/recon/breaks` | `runId=run_1&type=PRICE_MISMATCH` -> 200 breaks |
| AT-E32 | GET `/recon/breaks/{id}` | OPS break `brk_1` -> 200 internal/external detail |
| AT-E33 | POST `/recon/breaks/{id}/status` | OPS break `brk_1`, {status:"INVESTIGATING",reason:"Reviewing break"} -> 200 status update and audit entry |
| AT-E34 | POST `/recon/breaks/{id}/resolve` | OPS break `brk_1`, {resolution:"RESOLVED",reason:"Matched source"} -> 200 resolved break and audit entry |
| AT-E35 | GET `/recon/breaks/{id}/audit` | OPS break `brk_1` -> 200 audit items |
| AT-E36 | GET `/admin/users` | ADMIN -> 200 users |
| AT-E37 | POST `/admin/users` | ADMIN, {email:"b@example.com",password:"password1",role:"TRADER"} -> 201 user |
| AT-E38 | GET `/admin/accounts` | ADMIN -> 200 accounts |
| AT-E39 | POST `/admin/accounts` | ADMIN, {ownerUserId:"usr_1"} -> 201 account |
| AT-E40 | POST `/admin/accounts/{id}/deposit` | ADMIN account `acc_1`, {requestId:"dep-1",amount:"10000.00"} -> 200 deposit |
| AT-E41 | POST `/admin/instruments` | ADMIN, valid instrument body -> 201 instrument |
| AT-E42 | PUT `/admin/instruments/{symbol}` | ADMIN instrument `ACME`, valid config -> 200 instrument |
| AT-E43 | POST `/admin/demo/reset` | ADMIN demo profile -> 202 {status:"RESET_REQUESTED"}; 404 outside demo |
| AT-E44 | GET `/system/metrics/summary` | ADMIN -> 200 metrics summary |
| AT-E45 | GET `/system/shards` | ADMIN -> 200 shard list |
| AT-E46 | GET `/system/invariants` | ADMIN -> 200 invariant results |
| AT-E47 | POST `/system/verify-replay` | ADMIN, {symbol:"ACME"} -> 200 {equal:true,diffSummary:null} |
| AT-E48 | POST `/system/simulator/start` | ADMIN, {ratePerSec:10,symbols:["ACME"]} -> 202 {status:"START_REQUESTED"} |
| AT-E49 | POST `/system/simulator/stop` | ADMIN -> 202 {status:"STOP_REQUESTED"} |
| AT-E50 | POST `/system/chaos/kill-shard` | ADMIN demo profile -> 202; 404 outside demo |
| AT-E51 | POST `/system/chaos/freeze-shard` | ADMIN demo profile -> 202; 404 outside demo |
| AT-E52 | GET `/system/recovery` | ADMIN -> 200 recovery summary |

Validation rows are explicit in the grouped matrix: every field rule in
`api.md` gets its own 400 assertion (email/password, symbol/side/type/TIF,
tick/lot/max/unsafe integer, pagination/filter/date, reason, breaker integer
minimums, and multipart size/encoding/header/row rules). Mutating endpoints
also run their documented 202 happy path, 409 conflict, 429 rate-limit, and
503 dependency-unavailable cases; read endpoints run their documented 200,
400-query, 401, 403, and 404 cases.

Role matrix: one table-driven test enumerates every endpoint above and calls it
as TRADER, RISK, OPS, ADMIN, and anonymous. It asserts public auth exceptions,
GET permissions, write restrictions, account ownership 404, and role mismatch
403 exactly as `api.md` states. ADMIN can GET but receives 403 for order,
halt, resume, and reconciliation write operations.

## 5. WebSocket tests

| ID | Setup/action | Expected |
| --- | --- | --- |
| WT-1 | Connect and send no auth for 5 seconds | Server closes socket with code 4401 |
| WT-2 | Send `{op:"auth",token:"expired"}` | Close with code 4401; no subscription |
| WT-3 | Auth TRADER, subscribe `risk.rejections` | Forbidden topic; no data |
| WT-4 | Subscribe book, drop sequence 4 while receiving 3 and 5 | REST snapshot fetched; only deltas higher than snapshot seq applied |
| WT-5 | Slow client with full bufferedAmount and fast client | Slow stream conflates/disconnects with code 4408; fast latency unchanged |
| WT-6 | Ignore server ping/pong | Client dropped after keep-alive timeout |
| WT-7 | Disconnect/reconnect authenticated client | Resubscribe, snapshot plus higher deltas, stale state cleared |

## 6. UI acceptance checklist

| Screen/state | Data elements and endpoint fields | States |
| --- | --- | --- |
| P0 Home/auth | Login/register fields from POST `/auth/login` and `/auth/register`; user role/accountIds from response | loading, validation error, 401, demo-only register 404 |
| P2 Trading default | `/instruments` symbol/status; `/symbols/{s}/book` bids/asks/spread/lastPrice/seq; `/symbols/{s}/trades`; POST order 202 status; WS book/trades/user.orders | loading, empty book, error, stale connection |
| P2 Halted | `/symbols/{s}/status` state/reason/incident; order form remains enabled; submit returns 202 then `order.updated` REJECTED with `symbol_halted`; Cancel remains enabled and releases funds (K12) | loading, halted, error, stale connection |
| P2 Order rejected | GET `/orders/{id}` status/rejectReason and `/orders/{id}/events` accountSnapshot | pending, rejected, error, stale connection |
| P3 Portfolio default | `/accounts/{id}/balances`, positions, pnl, reservations, ledger; WS user.account | loading, empty positions, error, stale connection |
| P3 Portfolio empty | Same endpoints with empty `items` and zero totals | loading, empty, error, stale connection |
| P4 Filled | GET order status FILLED, filledQuantity/averageFillPrice, events/trades | loading, filled, error, stale connection |
| P4 Rejected | GET order status REJECTED, rejectReason, accountSnapshot | loading, rejected, error, stale connection |

## 7. Three-minute demo script

1. Open P0 and sign in as seeded TRADER; observe role and account ID.
2. Open P2 for ACME; observe instrument, empty/book snapshot, status, and seq.
3. Submit a sell limit and a crossing buy; observe 202 RECEIVED, WebSocket
   accepted/rested/fill events, maker-price trade, and updated book.
4. Open P3; observe balance held/released, position, and P&L updates.
5. Open P4 for the filled order; observe the audit timeline and reservation
   movements.
6. Submit an order exceeding available balance; observe 202 first, then
   OrderRejected with account snapshot, not a synchronous 422.
7. Halt ACME as RISK; observe P2 HALTED, order rejection, and existing
   reservations/resting-order policy.
8. Open P6 as OPS, upload a statement with one mismatch; observe a break,
   investigate/resolve it, and observe the audit/ledger adjustment.
9. Open P7 as ADMIN, show shard/metric/invariant state, kill/freeze a demo
   shard, and observe recovery or fencing evidence.
10. Reconnect the browser or drop a WebSocket message; observe REST snapshot
    resync, higher sequence deltas only, and stale indicator clearing.

## 8. Traceability

| Requirement | Mechanism | Test IDs |
| --- | --- | --- |
| Correct matching and fairness | Synchronous book, maker-price/FIFO tests | U1-U6, U15, P1-P4, P11 |
| No overspend | Account partition serialization and reservations | C1, C2, C6, K1-K3 |
| Deterministic replay | Stamped commands, journal, snapshots | P7, P8, R1-R3, R6 |
| Every rejection is observable | Rejection events and account snapshots | E3, K3, AT-ORD, AT-RISK |
| Ledger correctness | Double-entry invariant and reconciliation | P5, P6, X1-X6 |
| Breaker safety | State machine and halt policy | K4-K12 |
| Reliable messaging/fencing | Kafka idempotency and epoch checks | C3-C5, R5, R7-R12 |
| API/auth safety | JWT, role matrix, problem details | AT-AUTH, AT-ORD, AT-ACC, ROLE-MATRIX |
| Real-time UI | Snapshot/delta WS protocol | WT-1..WT-7, AT-MKT, UI checklist |
| Performance evidence | tinybench, k6, recovery curves | F1-F7 |

### MVP checklist traceability

| Blueprint 8.1 MVP item | Test coverage |
| --- | --- |
| Instruments/accounts seed data | AT-MKT-1..4, AT-ACC-1..7 |
| Limit/market/cancel | U1-U15, U13-U14, AT-ORD |
| Price-time matching | U1-U6, P1-P4/P11 |
| Single writer | C3, C5, C6 |
| Append-only journal | P7, R1-R5 |
| Snapshot/replay | P7, R1-R2, R6 |
| Async/idempotent 202 submission | C4, R9, AT-ORD-1..8 |
| Reservations/risk | C1-C2, K1-K3, P9 |
| Double-entry ledger | P5-P6, X6 |
| REST JWT roles | AT-AUTH, ROLE-MATRIX |
| Money codec | P10, money assertions in all AT rows |
| Tier-1 UI | UI checklist, WT-1..WT-7, demo script |
| Docker/CI/deployed demo | integration job, R7-R12, demo script |
| README/benchmarks/trade-offs | F1-F7 and documentation review |

### Gaps

All MVP items have at least one planned test ID. No additional gap is known;
however, the current repository has only the Week 2 engine and benchmark
implementation, so all later-week IDs remain PLANNED.

## 9. Weekly exit criteria

| Week | Tests that must be green |
| --- | --- |
| 1 | Setup checks: package smoke tests, boundary checks, initial CI verify |
| 2-3 | U1-U12, U15, P1-P4, P11, E1-E7, F1 |
| 4 | C2, C3, C5, C6, F3 |
| 5-6 | P7, P8, P10, R1, R2, R3, R6, C4 |
| 7 | U13, U14, P5, P6, P9, C1, K1-K3, R4 (C2 is kept as proof) |
| 8 | K4-K12, X1-X6 |
| 9 | AT-*, role matrix, WT-*, UI checklist, demo script |
| 10 | R5, R7-R12, E1/E2 scaling experiments |
| 11 | F2, F4, F6, F7, E3 optimisation |
| 12 | Full suite and demo |

## 10. How to run

| Layer | Command | Exists now? |
| --- | --- | --- |
| Build | `npm run build` | YES |
| Lint/purity | `npm run lint` | YES |
| Boundaries | `npm run check:boundaries` | YES |
| All current tests | `npm test` | YES |
| Unit only | `npm run test:unit` | NO; proposed |
| Property only | `npm run test:property` | NO; proposed |
| Integration containers | `npm run test:integration` | NO; proposed |
| Chaos | `npm run test:chaos` | NO; proposed |
| Risk/breaker | `npm run test:risk` | NO; proposed |
| API/contract | `npm run test:api` | NO; proposed |
| WebSocket | `npm run test:ws` | NO; proposed |
| Performance | `npm run bench` | YES |
| k6 load | `npm run test:load` | NO; proposed |

Until focused scripts are added, `npm test` is the authoritative verify command
and `npm run bench` runs F1/E3. Proposed scripts must select files rather than
silently weakening the full suite.
