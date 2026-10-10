# MatchLedger architecture reference

This document is the architecture reference for the repository. Normative
requirements are taken from the blueprint; the cited section is included after
each claim. Every component and flow is labelled with its blueprint build week
and current repository status.

Status meanings:

- **IMPLEMENTED** means the corresponding behavior exists in this checkout.
- **PLANNED** means the blueprint describes it, but the implementation is not
  present in this checkout.

## 1. Purpose and non-goals

MatchLedger is a deterministic simulation of the hard parts of an exchange
system: price-time matching, account-partitioned risk, reservations, an
append-only event history, fencing, recovery, reconciliation, read models, and
an asynchronous API. It is not a real-money system and it does not connect to
real market data. (3.3, 5.1, 8.1)

The architecture intentionally starts as a modular npm-workspaces monorepo and
splits along real boundaries only when the corresponding boundary is needed.
The circuit breaker is a folder inside `engine-core`, not a backend package.
(4.4)

**Flow schedule:** the engine and benchmark are built in Weeks 2–3; the
single-writer runner and first benchmark are Week 4; journaling and recovery
are Weeks 5–6; risk and ledger are Week 7; breaker and reconciliation are
Week 8; API, WebSocket, projections, and the first UI are Week 9; Kafka and
fencing are Week 10; observability and optimization are Week 11; deployment
and final documentation are Week 12. (15)

## 2. System context diagram

**Build/status:** Week 9 flow, with the Week 2–3 engine and Week 1 skeleton
implemented; the end-to-end context flow is **PLANNED**. (3.1, 5.1, 15)

```mermaid
flowchart LR
    Trader[Trader]
    Risk[Risk officer]
    Ops[Ops analyst]
    Admin[Admin]
    Simulator[Market simulator]

    subgraph Boundary[MatchLedger system boundary]
        Gateway[Fastify REST and WebSocket gateway]
        RiskStage[Account-partitioned risk stage]
        Shards[Symbol-partitioned shard runners]
        ReadSide[CQRS projections and read stores]
        BackOffice[Ledger and reconciliation]
    end

    Trader --> Gateway
    Risk --> Gateway
    Ops --> Gateway
    Admin --> Gateway
    Simulator --> Gateway
    Gateway --> RiskStage
    RiskStage --> Shards
    Shards --> ReadSide
    Shards --> BackOffice
    BackOffice --> ReadSide
    ReadSide --> Gateway
```

The diagram is a context view, not a claim that all pictured services are
currently runnable. The current repository contains the engine, codec,
boundary checks, API spike, projection helpers, journal spike, and benchmark;
the distributed flow is planned. (4.4, 15)

## 3. Container and package diagram

**Build/status:** Week 1 package skeleton and dependency checks are
**IMPLEMENTED**. The runtime edges below are the allowed target architecture;
unimplemented package behavior remains **PLANNED**. (4.4, 15)

```mermaid
flowchart LR
    engine[engine-core]
    common[common]
    journal[journal]
    shard[shard]
    risk[risk]
    ledger[ledger]
    recon[recon]
    projections[projections]
    api[api]
    simulator[simulator]
    benchmarks[benchmarks]
    web[web]

    common --> engine
    journal --> engine
    journal --> common
    shard --> engine
    shard --> common
    shard --> journal
    risk --> common
    risk --> journal
    ledger --> common
    ledger --> journal
    recon --> common
    recon --> journal
    projections --> common
    api --> common
    api --> journal
    api --> projections
    api --> risk
    api --> recon
    simulator --> common
    benchmarks --> engine
    web --> common
    web -. HTTP and WebSocket .-> api
```

The arrows are package-level “may depend on” edges, not call-order claims.
`common -> engine-core` represents the blueprint’s permitted use of
engine-core types by common. The web edge to API is a browser-to-HTTP/WS
interaction, not a runtime package dependency; the browser-safe package
dependency for web is `common`. (4.4, 5.10)

### Forbidden dependency and runtime rules

| Component | Forbidden dependency or behavior |
| --- | --- |
| engine-core, including `breaker/` | Any runtime dependency; `node:*`; npm imports; `async`, `await`, `Promise`; clock, random, environment, timer, or I/O APIs |
| common | `node:*`; it must remain browser-safe |
| journal | `web`, Kafka |
| shard | `api`, `web` |
| risk | `web` |
| ledger | `web`, Kafka |
| recon | `web`, Kafka |
| projections | engine-core internals |
| api | shard internals |
| simulator | API internals |
| benchmarks | Fastify, Kafka |
| web | Backend packages other than browser-safe `common` |

The boundary checker and ESLint purity rules enforce these restrictions.
(4.4, 4.7)

## 4. Component specifications

### 4.1 engine-core: book, matching, and breaker folder

**Build/status:** Weeks 2–3; **IMPLEMENTED** for the order book, synchronous
matching engine, IOC, cancel behavior, tests, and the `breaker/` package
location rule. The breaker state machine itself is **PLANNED** for Week 8.
(4.4, 5.3, 9.1, 15)

- **Responsibility:** Maintain one book per symbol, apply limit and IOC
  commands using price-time priority, and provide deterministic events and
  immutable views. A market order is not sent to the matcher uncapped; risk
  converts it to capped IOC. (5.3, 5.9)
- **Inputs:** Commands with explicit IDs and stamped `ts`; price and quantity
  are `bigint` minor units, not ticks. `Tick(ts)` is an input to time-based
  rules. (5.3, 5.8)
- **Outputs:** Event lists and read-only book snapshots. The current engine
  emits order acceptance/rejection, trades, resting, cancellation, and cancel
  rejection events. (5.3, 9.1)
- **State owned:** `Map<bigint, PriceLevel>` plus sorted price arrays for bids
  and asks; FIFO doubly linked lists within levels; `Map<string, OrderNode>`
  for order lookup. Bids are ascending and asks descending, so the best price
  is the last stored price. (4.4, 5.3)
- **Invariants:** Best bid is below best ask when both exist; prices are
  strictly ordered; each active price maps to one non-empty level; quantities
  never become negative; maker price and FIFO order determine fills. (9.1,
  10.1, 10.2)
- **Failure behavior:** Reject invalid quantity, price, tick, lot, maximum, or
  duplicate-ID commands without changing state. A cancel for an unknown or
  non-resting order emits `CancelRejected` without changing the snapshot.
  (9.1, 10.1)
- **Purity rules:** Zero runtime dependencies, synchronous execution, no clock,
  randomness, environment, I/O, `node:*`, `async`/`await`, or promises.
  Time and IDs are inputs. (4.2, 4.4, 5.3, 5.8)

The implemented book structure is:

```text
OrderBook
├── bids: Map<bigint, PriceLevel> + SortedPrices(BUY)
└── asks: Map<bigint, PriceLevel> + SortedPrices(SELL)
    └── PriceLevel: head/tail doubly linked FIFO list of OrderNode

OrderBook.orders: Map<string, OrderNode>
```

| Operation | Complexity |
| --- | --- |
| Best bid/ask | O(1) |
| Add to an existing level | O(1) |
| Add a new level | O(log n) search + O(n) array shift |
| Match one maker | O(1), excluding level removal |
| Cancel | O(1), plus O(n) price-array shift when a level empties |

The matching loop validates in fixed order, emits `OrderAccepted`, consumes the
oldest crossing makers at maker price, emits `TradeExecuted`, removes fully
filled makers, and appends a remainder as `OrderRested`. For IOC, the supplied
price cap is the hard crossing limit; any remainder emits an
`OrderCancelled` with the IOC remainder reason and never rests. `CancelOrder`
looks up the order in the ID map, unlinks it, removes an empty level, and
emits either `OrderCancelled` or `CancelRejected`. (9.1, 10.1)

### 4.2 shard runner

**Build/status:** Week 4 for the runner and Weeks 5–6 for journaling/recovery;
**PLANNED**. (5.7, 5.8, 15)

- **Responsibility:** Provide the impure boundary around engine-core: bounded
  input queue, timestamp stamping, journal append, Tick injection, Kafka
  consume/produce, snapshots, recovery, and event-loop yielding. (5.7, 5.8)
- **Inputs:** Commands from the gateway or risk stage, wall-clock reads only at
  the input stage, Kafka records, and process signals. (5.8)
- **Outputs:** Journaled stamped commands, engine events, Kafka records,
  snapshots, and client-visible asynchronous outcomes. (5.6–5.8)
- **State owned:** Shard ownership, last stamped timestamp, engine state,
  journal sequence, snapshot position, lease epoch, and bounded queue.
- **Invariants:** `ts = max(lastTs, now)`; every time-based behavior is driven
  by stamped commands or `Tick(ts)`; one symbol has one active writer; journal
  sequence numbers are monotonic. (5.7, 5.8)
- **Failure behavior:** Fencing failure, uncaught exception, or unhandled
  rejection causes fail-stop and supervisor restart. SIGTERM stops consuming,
  flushes the journal, releases the lease, and exits. Recovery loads the last
  valid snapshot and replays the journal tail. (5.7, 10.4)

### 4.3 risk stage

**Build/status:** Week 7; **PLANNED**. (5.3, 5.9, 9.2, 15)

- **Responsibility:** Serialize account risk decisions, check cash/shares,
  manage reservations, convert market orders, and produce accepted or rejected
  outcomes. (9.2)
- **Inputs:** `OrderSubmitted` keyed by `accountId`, account balances and
  positions, instrument rules, reference prices, breaker/halt state, and
  account events. (5.6, 5.9)
- **Outputs:** `ReservationPlaced`, `OrderAccepted` with price cap,
  `ReservationConverted`, `ReservationReleased`, or `OrderRejected` with an
  account snapshot. (9.2, 10.5)
- **State owned:** Account-partitioned balances, held cash, available shares,
  reservations, idempotency records, and the awaited-loop queue.
- **Invariants:** Messages for one account execute one at a time; available
  cash and shares never become negative; a buy reservation is
  `priceCap * quantity`; a sell reservation is shares; reservation conversion
  and release reconcile with fills and cancels. (9.2)
- **Failure behavior:** Insufficient balance rejects before any reservation and
  does not emit `OrderAccepted`; duplicate `clientOrderId` returns the original
  outcome; a halted symbol rejects early with `symbol_halted`. (5.6, 9.2,
  10.5)

Market-order conversion uses the four-step chain: current best opposite-side
price, last trade price, configured static reference price, then
`NO_REFERENCE_PRICE` rejection. The selected reference is widened by the
protection band to form the hard IOC cap. (5.9)

### 4.4 journal

**Build/status:** Weeks 5–6; **PLANNED** beyond the current PostgreSQL/int8
spike. (5.3, 5.7, 15)

- **Responsibility:** Store the append-only command and event history and
  snapshot metadata. (5.7)
- **Inputs:** Stamped commands, `Tick` commands, engine/risk/breaker events,
  writer epoch, stream ID, and sequence. (5.7, 5.8)
- **Outputs:** Durable append acknowledgements, replay streams, snapshot
  records, and recovery tails.
- **State owned:** `journal`, `snapshots`, and append sequence allocation.
- **Invariants:** `record_type` is `COMMAND` or `EVENT`; `(stream_id, seq)` is
  the primary key; sequence numbers are monotonic; writes carry the fencing
  epoch; inserts are batched. (5.7)
- **Failure behavior:** Reject stale-epoch writes; retain the previous valid
  snapshot if a snapshot write is interrupted; replay only the tail after the
  snapshot. (10.4)

### 4.5 ledger

**Build/status:** Week 7; **PLANNED**. (9.2, 10.2, 15)

- **Responsibility:** Record every cash and position movement as double-entry
  ledger rows and support reconciliation adjustments.
- **Inputs:** Reservation conversions/releases, fills, deposits, fees, and
  approved reconciliation resolutions.
- **Outputs:** Append-only `ledger_entries`, balances, and invariant results.
- **State owned:** Ledger entries and account balances derived from them.
- **Invariants:** Every transaction has balanced debits and credits; replay
  produces the same balances; positions sum to zero per symbol. (10.2,
  10.5–10.6)
- **Failure behavior:** Reject unbalanced entries and preserve the append-only
  history; a reconciliation adjustment is written as a balanced pair.

### 4.6 recon

**Build/status:** Week 8; **PLANNED**. (9.6, 10.6, 15)

- **Responsibility:** Stream external CSV statements, compare them with
  internal trades, create breaks, and manage break status and audit history.
- **Inputs:** CSV rows, internal trade/ledger views, and operator status or
  resolution commands.
- **Outputs:** `recon_runs`, `recon_breaks`, audit records, and optional
  balanced ledger adjustments.
- **State owned:** Run metadata, break type/status, external values, and audit
  transitions.
- **Invariants:** File hash makes upload idempotent; matching is streamed;
  resolving a break records an audit entry; an adjustment is balanced. (5.10,
  10.6)
- **Failure behavior:** Report row/line validation errors; duplicate file
  upload returns the existing run; unresolved breaks remain visible.

### 4.7 projections

**Build/status:** Week 9; **PLANNED**. (5.1, 15)

- **Responsibility:** Consume events and maintain CQRS read models for order
  status, positions, P&L, balances, reservations, and top-of-book data.
- **Inputs:** Journal/Kafka events and ledger results.
- **Outputs:** PostgreSQL read models, Redis hot reads, and WebSocket payloads.
- **State owned:** `orders_view`, `positions_view`, cached book/status data.
- **Invariants:** Projection application is idempotent by event sequence; read
  values reflect only journaled facts; money at API boundaries is a decimal
  string. (4.2, 5.1, 5.10)
- **Failure behavior:** Rebuild from the journal; do not invent a successful
  outcome when an event is missing.

### 4.8 api

**Build/status:** Week 9; the Fastify/JWT/WebSocket health and auth spike is
**IMPLEMENTED**; the complete gateway is **PLANNED**. (4.1, 5.6, 5.10,
15)

- **Responsibility:** Validate requests, authenticate JWTs, enforce roles and
  ownership, deduplicate ingress, publish durable `OrderSubmitted`, return
  asynchronous 202 responses, serve read models, and fan out WebSocket
  updates. (5.6, 5.10)
- **Inputs:** HTTP, multipart reconciliation uploads, WebSocket auth and
  subscription messages, JWTs, and read-model queries.
- **Outputs:** REST resources/errors, 202 `RECEIVED` order acknowledgements,
  WebSocket envelopes, metrics, and logs.
- **State owned:** Gateway idempotency records, rate-limit state, WebSocket
  subscriptions/buffers, and auth configuration.
- **Invariants:** A 202 means durably received, not accepted or filled;
  quantities and money are decimal strings in JSON; a retry with the same
  `clientOrderId` and payload returns the original order. (5.6, 5.10)
- **Failure behavior:** Return 401/403/404 according to authentication,
  role, and ownership; return 503 when durable publish is unavailable; close
  unauthenticated sockets with the documented timeout behavior and slow
  consumers after the buffer limit. (5.10, 10.7)

### 4.9 simulator

**Build/status:** Week 9 demo surface, with system-dashboard controls in Week
11; **PLANNED**. (5.10, 15)

- **Responsibility:** Generate deterministic simulated order flow and expose
  demo-only start/stop controls.
- **Inputs:** Rate, symbol list, explicit IDs/timestamps, and simulator
  commands.
- **Outputs:** `OrderSubmitted` traffic and simulator status events.
- **State owned:** Simulator run state and deterministic sequence inputs.
- **Invariants:** It is not a real market-data source; generated activity
  remains subject to the same API, risk, and journal boundaries. (3.3, 5.10)
- **Failure behavior:** Stop on command or process failure; demo-only controls
  return 404 outside the demo profile. (5.10)

### 4.10 benchmarks

**Build/status:** Week 2–3 core benchmark **IMPLEMENTED**; Week 4 comparison
and Weeks 11–12 load/recovery measurements **PLANNED**. (10.8, 15)

- **Responsibility:** Measure order-book add/match/cancel operations, then
  compare serialized and naive async designs and record scaling evidence.
- **Inputs:** Fixed benchmark fixtures, engine commands, load profiles, and
  explicit environment limits.
- **Outputs:** Ops/sec, latency percentiles, allocation/heap observations,
  recovery curves, and optimization tables.
- **State owned:** Benchmark fixture state only; no production ledger or order
  state.
- **Invariants:** Measurements state workload, warm-up, duration, and what the
  experiment does not prove. (11.3, 11.4)
- **Failure behavior:** A missing external service or tool blocks that
  measurement; it must not be presented as a successful production result.

### 4.11 web

**Build/status:** Week 9 for tier 1 pages and Week 11 for the system dashboard;
**PLANNED**. (3.4, 5.10, 15)

- **Responsibility:** React dashboard for authentication, trading, portfolio,
  reconciliation, and system pages.
- **Inputs:** API REST responses, WebSocket envelopes, route role guards, and
  browser-safe common types.
- **Outputs:** P0–P8 pages, pending states for 202 actions, resync views, and
  the three-minute demo flow.
- **State owned:** Query cache, socket connection/subscriptions, local form
  state, and UI estimates labelled as estimates.
- **Invariants:** No UI element without a backing endpoint; fonts and numeric
  display rules follow the frontend constraints; 202 remains pending until
  the outcome event arrives. (3.4, 5.10)
- **Failure behavior:** Show loading, validation, authorization, stale
  connection, and resync states without treating an estimate as authoritative.

## 5. Order lifecycle

**Build/status:** API-to-risk-to-shard lifecycle is Week 9 and planned; the
engine-side matching portion is Weeks 2–3 and implemented. (5.2, 5.6, 15)

### 5.1 Filled, insufficient-balance, and halted paths

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant R as Risk
    participant S as Shard
    participant P as Projection

    C->>G: POST /orders
    G->>G: Authenticate, validate, deduplicate
    G-->>C: 202 RECEIVED
    G->>R: OrderSubmitted
    alt Filled
        R->>R: Check and place reservation
        R->>S: OrderAccepted
        S->>S: Match at maker price
        S-->>P: TradeExecuted and Order status events
        P-->>C: order.updated FILLED
    else Insufficient balance
        R->>R: Check available cash
        R-->>P: OrderRejected insufficient_balance and accountSnapshot
        P-->>C: order.updated REJECTED
    else Symbol halted
        R->>R: Check halt before reservation
        R-->>P: OrderRejected symbol_halted
        P-->>C: order.updated REJECTED
    end
```

The insufficient-balance path has no reservation and no `OrderAccepted`. The
halt path also rejects before reservation. A 202 is only durable receipt.
(5.6, 5.2, 9.2, 10.5)

### 5.2 Order status state machine

```mermaid
stateDiagram-v2
    [*] --> RECEIVED: OrderSubmitted durably published
    RECEIVED --> ACCEPTED: OrderAccepted
    RECEIVED --> REJECTED: OrderRejected
    ACCEPTED --> RESTING: OrderRested
    ACCEPTED --> PARTIALLY_FILLED: TradeExecuted with remainder
    ACCEPTED --> FILLED: TradeExecuted fills quantity
    ACCEPTED --> CANCEL_REQUESTED: CancelRequested
    RESTING --> PARTIALLY_FILLED: TradeExecuted with remainder
    RESTING --> FILLED: TradeExecuted fills quantity
    RESTING --> CANCEL_REQUESTED: CancelRequested
    PARTIALLY_FILLED --> PARTIALLY_FILLED: TradeExecuted with remainder
    PARTIALLY_FILLED --> FILLED: TradeExecuted fills remainder
    PARTIALLY_FILLED --> CANCEL_REQUESTED: CancelRequested
    CANCEL_REQUESTED --> CANCELLED: OrderCancelled
    RESTING --> CANCELLED: IOC_REMAINDER OrderCancelled
    PARTIALLY_FILLED --> CANCELLED: IOC_REMAINDER OrderCancelled
    FILLED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]
```

`CancelRequested` is the API’s asynchronous command state; the final
`OrderCancelled` event determines `CANCELLED`. (5.6, 5.10)

## 6. Event catalogue

All money, price, and quantity fields are `bigint` in internal TypeScript and
`decimal string` at JSON, PostgreSQL, Redis, and Kafka boundaries. The
ordering key is the partition or stream key; the idempotency key prevents
duplicate command or event application. (4.2, 5.3, 5.7)

| Event | Producer | Consumers | Key fields and types | Ordering key | Idempotency key |
| --- | --- | --- | --- | --- | --- |
| `OrderSubmitted` | API | risk, journal | `orderId:string`, `clientOrderId:string`, `accountId:string`, `symbol:string`, `quantity:bigint`, `price:bigint?`, `ts:input` | `accountId` | `(accountId, clientOrderId)` |
| `OrderAccepted` | risk | shard, projections, journal | `orderId`, `accountId`, `symbol`, `quantity:bigint`, `priceCap:bigint`, `reservationId` | `symbol` | `orderId` |
| `OrderRejected` | risk or matcher | projections, journal, client | `orderId`, `reason`, `accountSnapshot`, `quantity:bigint` | `accountId` then `symbol` | `orderId` |
| `OrderRested` | matcher | projections, journal | `orderId`, `symbol`, `price:bigint`, `remaining:bigint`, `arrivalSeq:bigint` | `symbol` | `(symbol, engineSeq)` |
| `TradeExecuted` | matcher | risk, ledger, projections, journal | `tradeId:string` such as `ACME-T1`, maker/taker IDs, `price:bigint`, `quantity:bigint` | `symbol` | `tradeId` |
| `OrderCancelled` | matcher/API | risk, projections, journal | `orderId`, `reason`, `remaining:bigint` | `symbol` | `(orderId, cancelRequestId)` |
| `CancelRejected` | matcher | projections, client, journal | `orderId`, `reason` | `symbol` | `cancelRequestId` |
| `ReservationPlaced` | risk | ledger, projections, journal | `reservationId`, `accountId`, `orderId`, `amount:bigint` or `shares:bigint` | `accountId` | `reservationId` |
| `ReservationConverted` | risk | ledger, projections, journal | `reservationId`, `tradeId`, `amount:bigint`, `quantity:bigint` | `accountId` | `(reservationId, tradeId)` |
| `ReservationReleased` | risk | ledger, projections, journal | `reservationId`, `orderId`, `amount:bigint` or `shares:bigint`, `reason` | `accountId` | `(reservationId, releaseSeq)` |
| `BreakerTripped` | breaker | risk, shard, projections, journal | `symbol`, `state`, `ts`, `engineSeq:bigint` | `symbol` | `(symbol, engineSeq)` |
| `BreakerHalfOpened` | breaker | risk, shard, projections, journal | `symbol`, `ts`, `engineSeq:bigint` | `symbol` | `(symbol, engineSeq)` |
| `BreakerClosed` | breaker | risk, shard, projections, journal | `symbol`, `ts`, `engineSeq:bigint` | `symbol` | `(symbol, engineSeq)` |
| `Tick` | shard input stage | engine, breaker, journal | `ts`, `symbol?`, `engineSeq:bigint?` | `symbol` or shard stream | `(stream_id, seq)` |

The current Week 2 engine implements the matching-side events; risk,
reservations, breaker, and distributed consumers are planned. (15)

## 7. Kafka topic layout

**Build/status:** Week 10; **PLANNED**. The v1 in-process equivalent is also
planned as part of the Week 4 runner; the current repository has no Kafka
runtime. (5.4, 15)

| Topic | Key | Producer | Consumers | Purpose |
| --- | --- | --- | --- | --- |
| `orders.submitted` | `accountId` | API | risk workers | Durable ingress |
| `orders.accepted` | `symbol` | risk | shard runners | Accepted orders with reservation/cap |
| `engine.events` | `symbol` | shards | journal, projections, ledger, risk | Matching and breaker facts |
| `account.events` | `accountId` | risk/shard adapters | risk workers, projections, ledger | Fills, cancels, reservation effects |
| `ticks` | `symbol` | shard input/simulator | shard/breaker | Explicit time input |

The v1 in-process equivalent is:

| Boundary | In-process representation |
| --- | --- |
| API to risk | Bounded `OrderSubmitted` queue |
| Risk to shard | Event list or bounded accepted-order queue |
| Shard to readers | Journal append followed by synchronous adapter callbacks |
| Time | `Tick(ts)` command |

Kafka keys preserve per-account or per-symbol ordering; transactions and
fencing are required when the boundaries move to Kafka. (5.4, 5.7)

## 8. Data model

**Build/status:** Week 1 schema skeleton and Week 2 engine state are
**IMPLEMENTED**; the persistent tables and read models are **PLANNED** for
Weeks 5–9. (5.5, 15)

```mermaid
erDiagram
    users ||--o{ accounts : owns
    users ||--o| risk_limits : has
    accounts ||--o{ order_requests : submits
    accounts ||--o{ reservations : holds
    accounts ||--o{ ledger_entries : posts
    instruments ||--o{ order_requests : validates
    order_requests ||--o| orders_view : projects
    accounts ||--o{ positions_view : owns
    journal ||--o{ snapshots : checkpoints
    recon_runs ||--o{ recon_breaks : contains
    orders_view ||--o{ recon_breaks : references
```

All persistent money, price, and quantity columns below are `BIGINT`; API and
other external boundaries encode them as decimal strings. (4.2, 5.5)

### 8.1 `users`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `user_id` | UUID | PK | primary | api |
| `email` | TEXT | unique, not null | unique | api |
| `password_hash` | TEXT | not null | — | api |
| `role` | TEXT | TRADER/RISK/OPS/ADMIN | role | api |
| `created_at` | TIMESTAMPTZ | not null | — | api |

### 8.2 `accounts`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `account_id` | UUID | PK | primary | risk |
| `owner_user_id` | UUID | FK users, not null | owner | api |
| `total_cash` | BIGINT | not null, >= 0 | — | risk |
| `held_cash` | BIGINT | not null, >= 0 | — | risk |
| `created_at` | TIMESTAMPTZ | not null | — | api |

### 8.3 `instruments`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `symbol` | TEXT | PK | primary | api |
| `tick_size` | BIGINT | > 0 | — | engine-core |
| `lot_size` | BIGINT | > 0 | — | engine-core |
| `max_quantity` | BIGINT | > 0 | — | engine-core |
| `max_price` | BIGINT | > 0 | — | engine-core |
| `reference_price` | BIGINT | nullable | — | risk |

### 8.4 `risk_limits`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `account_id` | UUID | PK/FK accounts | primary | risk |
| `max_order_notional` | BIGINT | >= 0 | — | risk |
| `max_open_orders` | INTEGER | >= 0 | — | risk |
| `max_position_per_symbol` | BIGINT | >= 0 | — | risk |

### 8.5 `order_requests`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `order_id` | UUID | PK | primary | api |
| `account_id` | UUID | FK accounts | account | api |
| `client_order_id` | TEXT | unique per account | `(account_id, client_order_id)` | api |
| `symbol` | TEXT | FK instruments | symbol | api |
| `side` | TEXT | BUY/SELL | — | engine-core |
| `order_type` | TEXT | LIMIT/IOC/MARKET | — | engine-core |
| `quantity` | BIGINT | > 0 | — | engine-core |
| `price` | BIGINT | nullable, > 0 | — | engine-core |
| `ts` | TIMESTAMPTZ | stamped input | — | shard |

### 8.6 `shard_leases`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `shard_id` | TEXT | PK | primary | shard |
| `symbol` | TEXT | unique active owner | symbol | shard |
| `owner_instance` | TEXT | not null | owner | shard |
| `writer_epoch` | BIGINT | monotonic | — | shard |
| `expires_at` | TIMESTAMPTZ | not null | expiry | shard |

### 8.7 `journal`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `stream_id` | TEXT | PK part | `(stream_id, seq)` | journal |
| `seq` | BIGINT | PK part, monotonic | `(stream_id, seq)` | journal |
| `record_type` | TEXT | COMMAND/EVENT | type | journal |
| `event_type` | TEXT | not null | — | journal |
| `payload` | JSONB | immutable | — | journal |
| `writer_epoch` | BIGINT | fencing check | epoch | journal |
| `ts` | TIMESTAMPTZ | stamped | — | journal |

### 8.8 `snapshots`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `stream_id` | TEXT | PK part/FK journal stream | `(stream_id, seq)` | journal |
| `seq` | BIGINT | PK part | `(stream_id, seq)` | journal |
| `state` | JSONB | immutable | — | journal |
| `writer_epoch` | BIGINT | fencing check | epoch | journal |
| `created_at` | TIMESTAMPTZ | not null | — | journal |

### 8.9 `ledger_entries`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `entry_id` | UUID | PK | primary | ledger |
| `transaction_id` | UUID | balanced group | transaction | ledger |
| `account_id` | UUID | FK accounts | account | ledger |
| `asset` | TEXT | not null | asset | ledger |
| `debit` | BIGINT | >= 0 | — | ledger |
| `credit` | BIGINT | >= 0 | — | ledger |
| `source_event_id` | TEXT | unique | source | ledger |

### 8.10 `reservations`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `reservation_id` | UUID | PK | primary | risk |
| `account_id` | UUID | FK accounts | account | risk |
| `order_id` | UUID | unique | order | risk |
| `amount` | BIGINT | >= 0 | — | risk |
| `shares` | BIGINT | >= 0 | — | risk |
| `status` | TEXT | PLACED/CONVERTED/RELEASED | status | risk |

### 8.11 `orders_view`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `order_id` | UUID | PK | primary | projections |
| `account_id` | UUID | FK accounts | account | projections |
| `symbol` | TEXT | not null | symbol | projections |
| `status` | TEXT | lifecycle enum | status | projections |
| `quantity` | BIGINT | >= 0 | — | projections |
| `filled_quantity` | BIGINT | >= 0 | — | projections |
| `average_fill_price` | BIGINT | nullable | — | projections |
| `reject_reason` | TEXT | nullable | reason | projections |
| `last_seq` | BIGINT | idempotency cursor | `(order_id, last_seq)` | projections |

### 8.12 `positions_view`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `account_id` | UUID | PK part | `(account_id, symbol)` | projections |
| `symbol` | TEXT | PK part | `(account_id, symbol)` | projections |
| `quantity` | BIGINT | signed position | — | projections |
| `average_price` | BIGINT | nullable | — | projections |
| `last_seq` | BIGINT | idempotency cursor | — | projections |

### 8.13 `recon_runs`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `run_id` | UUID | PK | primary | recon |
| `file_hash` | TEXT | unique | unique | recon |
| `status` | TEXT | PROCESSING/COMPLETED/FAILED | status | recon |
| `filename` | TEXT | not null | — | recon |
| `started_at` | TIMESTAMPTZ | not null | — | recon |
| `finished_at` | TIMESTAMPTZ | nullable | — | recon |

### 8.14 `recon_breaks`

| Column | Type | Constraints | Index | Owner |
| --- | --- | --- | --- | --- |
| `break_id` | UUID | PK | primary | recon |
| `run_id` | UUID | FK recon_runs | run | recon |
| `trade_id` | TEXT | nullable | trade | recon |
| `break_type` | TEXT | defined break enum | type | recon |
| `status` | TEXT | OPEN/INVESTIGATING/RESOLVED/WRITTEN_OFF | status | recon |
| `internal_value` | JSONB | nullable | — | recon |
| `external_value` | JSONB | nullable | — | recon |

## 9. Concurrency and correctness guarantees

| Guarantee | Mechanism | Enforcement point | Proving test |
| --- | --- | --- | --- |
| One writer per symbol/account and no zombie writes | Single event loop per shard, partition ownership, lease `writer_epoch`, epoch check on journal writes | shard, journal | C3, R5, R7, R8, R11, R12 (10.3–10.4) |
| No await race in account risk | One awaited loop per account partition; no concurrent handlers for one account | risk | C1, C2, C6 (10.3) |
| Determinism and replay | Stamped commands and ticks; engine reads no environment; replay uses identical inputs | engine-core, shard, journal | P7, P8, R1–R3, R6 (10.2, 10.4) |
| Idempotency at two boundaries | Gateway `(accountId, clientOrderId)` dedupe and risk-stage dedupe | api and risk | C4, R9, 10.7 API idempotency test |
| Reservation safety bound | Buy reservation `priceCap * quantity`; matcher enforces same cap; release improvement/remainder | risk and matcher | P9, K1–K3 (10.2, 10.5) |
| Halt policy and maximum halt duration | Early `symbol_halted` rejection; force-cancel resting orders after `maxHaltDuration` | risk and breaker | K10–K12 (10.5) |

## 10. Failure modes

| Crash point or fault | Detection | Recovery | Test |
| --- | --- | --- | --- |
| After journal append, before publish | Durable sequence exists without downstream result | Replay journal and publish/apply idempotently | P7, R1, R3 |
| Mid-snapshot write | Snapshot is incomplete or invalid | Use previous valid snapshot and replay the tail | R2 |
| Gateway after Kafka publish, before 202 | Client retry with same `clientOrderId`; durable record exists | Return original order ID; do not create a second order | R9 |
| Zombie after pause | Lease epoch on journal write rejects stale writer | Fail-stop stale instance; surviving owner continues | R7 |
| Event loop stalled past session timeout | Consumer group reassigns partition; resumed writer fails epoch check | Restart fenced process and replay | R8, R11 |
| Kafka unavailable | Publish/transaction failure | Return 503, never 202, and create no order | R10 |

## 11. Security model

JWT claims are `{sub, role, accountIds, exp}`. JWT verification uses `jose`;
role checks are Fastify hooks. (4.1, 5.10)

| Role | Order/account own data | Risk limits and halt | Reconciliation | Admin/system | Market/read data |
| --- | --- | --- | --- | --- | --- |
| TRADER | Own orders and accounts | No | No | No | Authenticated reads |
| RISK | No other trader’s private data | Yes | No | No | Authenticated reads |
| OPS | No trader writes | No | Yes | No | Authenticated reads |
| ADMIN | GET/read access; order writes return 403 | Halt/resolve restrictions per API matrix | Resolve/write restrictions per API matrix | Yes | Yes |

Missing/expired credentials return 401. An authenticated role without
permission returns 403. A trader requesting another trader’s resource returns
404, preventing resource disclosure. (5.10, 10.7)

Demo-profile-only features are public registration, demo reset, simulator
controls, and chaos kill/freeze controls; outside the demo profile they return
404. (5.10)

## 12. Observability

**Build/status:** Week 11; **PLANNED**. The names below are the required
prom-client measurement surface. (4.1, 15)

| Metric | Type/labels | Meaning |
| --- | --- | --- |
| `orders_received_total` | counter | Orders durably received at ingress |
| `orders_rejected_total{reason}` | counter | Rejections grouped by reason |
| `match_latency_seconds` | histogram | Matcher processing latency |
| `journal_append_seconds` | histogram | Journal append latency |
| `kafka_consumer_lag` | gauge | Consumer lag by topic/partition |
| `event_loop_lag_seconds` | gauge/histogram | Event-loop scheduling delay |
| `ws_clients` | gauge | Connected WebSocket clients |
| `ws_conflated_total` | counter | Messages replaced by conflation |
| `breaker_state{symbol}` | gauge/state label | Current breaker state per symbol |

Prometheus scrapes the metrics endpoint and Grafana presents dashboards.
(4.1, 15)

## 13. Deployment topology

**Build/status:** Week 1 local services and CI compose are **IMPLEMENTED**;
application deployment and the demo topology are **PLANNED** for Week 12.
(4.1, 4.3, 15)

```mermaid
flowchart LR
    API[api and web application]
    PG[(PostgreSQL 18)]
    Redis[(Redis 8)]
    Kafka[(Kafka 4.2.2)]
    Prom[Prometheus]
    Graf[Grafana]
    API --> PG
    API --> Redis
    API --> Kafka
    Kafka --> PG
    Prom --> Graf
```

| Service | Image/port | Role | Demo-only |
| --- | --- | --- | --- |
| PostgreSQL | `postgres:18`, `5432` | Journal, snapshots, ledger, read models, reconciliation | No |
| Redis | `redis:8`, `6379` | Hot read models and rate limits | No |
| Kafka | `apache/kafka:4.2.2`, `29092` external / `9092` internal | Topics and transactions | No |
| Prometheus | `prom/prometheus:v3.11.2`, `9090` | Metrics scraping | No |
| Grafana | `grafana/grafana:13.1.3`, `3000` | Dashboards | No |
| API | Node 24 application port | REST and WebSocket | No |
| Web | Vite/React application port | Browser UI | No |
| Simulator and chaos controls | API-controlled | Demo flow and failure demonstrations | Yes |

### 13.1 Environment variables

Defaults below are local-development defaults where the repository defines
them; production deployment must provide pinned, non-default values. (4.3,
4.6)

| Name | Default | Used by |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://postgres:matchledger@localhost:5432/matchledger` | journal, ledger, projections, recon |
| `REDIS_URL` | `redis://localhost:6379` | projections, api |
| `KAFKA_BROKERS` | `localhost:29092` | shard, risk, projections, simulator |
| `JWT_SECRET` | unset | api; required outside local demo |
| `DEMO_PROFILE` | `false` | api, simulator, chaos controls |
| `PORT` | `3000` | api |
| `METRICS_PORT` | `9090` | api/prom-client |
| `SHARD_ID` | unset | shard |
| `ACCOUNT_PARTITIONS` | unset | risk |
| `RUN_LIVE_SPIKES` | `0` | integration spike tests |

The current compose file supplies service images and ports; it does not yet
define the application environment contract. Therefore the application
variables are **PLANNED** configuration, not implemented runtime claims.

## 14. Build-status matrix and known limitations

### 14.1 Build-status matrix

| Component | Blueprint build week | Status in this checkout |
| --- | --- | --- |
| Workspace skeleton and dependency boundaries | Week 1 | IMPLEMENTED |
| `engine-core` book and matching | Weeks 2–3 | IMPLEMENTED |
| `engine-core` breaker state machine | Week 8 | PLANNED |
| `benchmarks` core tinybench | Weeks 2–3 | IMPLEMENTED |
| `shard` runner and first benchmark comparison | Week 4 | PLANNED |
| `journal` append/replay/snapshots | Weeks 5–6 | PLANNED |
| `risk` reservations and account serialization | Week 7 | PLANNED |
| `ledger` double-entry invariants | Week 7 | PLANNED |
| `recon` CSV and break workflow | Week 8 | PLANNED |
| `api` complete REST/WS gateway | Week 9 | PLANNED |
| `api` auth/WebSocket spike | Week 1 spike | IMPLEMENTED |
| `projections` CQRS read side | Week 9 | PLANNED |
| `simulator` | Week 9 | PLANNED |
| `web` tier-1 pages | Week 9 | PLANNED |
| `web` system dashboard | Week 11 | PLANNED |
| Kafka topics and fencing | Week 10 | PLANNED |
| Prometheus/Grafana metrics | Week 11 | PLANNED |
| Deployment and final documentation | Week 12 | PLANNED |

### 14.2 Known limitations

- The current checkout implements the Week 2–3 engine and selected Week 1
  boundary/API/codec/journal/projection spikes, not the complete distributed
  system.
- The current engine has no real-money custody, exchange connectivity, or real
  market-data feed. (3.3)
- PostgreSQL, Redis, and Kafka compose services exist, but the full journal,
  risk, ledger, reconciliation, projection, and Kafka runtime flows are not
  implemented.
- Breaker, fencing epochs, snapshots/recovery, and fail-stop process handling
  remain planned.
- WebSocket and UI production surfaces remain planned beyond the auth spike.
- Metrics, load tests, recovery curves, and deployment evidence remain planned.
- The API environment-variable defaults in this document are an architecture
  contract proposal; the compose file does not yet wire them to a complete
  application.

## Assumptions

- Blueprint section 5.4 names four core Kafka topics; this reference adds a
  `ticks` topic as the natural Kafka representation of the explicit `Tick`
  input required by (5.8). The v1 in-process equivalent is listed separately.
- Blueprint section 5.5 gives a simplified model rather than a migration
  schema. The additional `users` and `risk_limits` tables are included because
  the API and role/limits contract requires them; their ownership follows
  (5.10) and (9.2).
- The blueprint specifies behavior and package boundaries but not exact UUID
  versus TEXT storage for every identifier. UUID is used for database identity
  columns; event and stream identifiers remain TEXT where the event contract
  uses strings.
- The blueprint names Kafka, PostgreSQL, Redis, Prometheus, and Grafana
  services but does not define every application environment variable. The
  variable table records the minimal names implied by (4.1), (4.3), and the
  compose topology and marks their runtime wiring as planned.
- The architecture uses `bigint` for internal money, price, and quantity and
  decimal strings at boundaries. “Minor units” means the integer represents
  the smallest configured currency unit; it is not a Kafka tick count. (4.2,
  5.3)
