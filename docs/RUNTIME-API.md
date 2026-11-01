# Runtime Facade API (Week 9 Inventory; historical)

The missing-method table in this opening inventory describes the Week 9 checkpoint only. It is superseded by the runnable Week 11 composition documented below; do not treat those rows as current API status.

## Current Public Methods

### wireRuntime(config: WireConfig)
**File:** `packages/runtime/src/wire.ts`
```ts
async function wireRuntime(config: WireConfig): Promise<{
  recovery: PipelineHandle;
  books: Map<number, any>;
  riskCores: Map<number, any>;
  engineState: any;
  ledgerState: any;
  owners: Map<string, string>;
  watermark: number;
}>
```
Returns recovered pipeline state with books, risk cores, and order owners.

### recoverPipeline(config: RecoveryConfig)
**File:** `packages/runtime/src/recover-pipeline.ts`
```ts
async function recoverPipeline(config: RecoveryConfig): Promise<PipelineHandle>
```
Recovers the pipeline from journals and snapshots. Returns `PipelineHandle` with:
- `router: EngineEventRouter`
- `ledger: Ledger`
- `stats: { replayed, regenerated, caughtUp, redelivered }`

## Missing Facade Methods (Needed for Week 9 API)

| Need | Signature | File | Status |
|------|-----------|------|--------|
| `submitOrder` | `(cmd: SubmitOrderCommand) => Promise<{ kind: 'JOURNALED', riskSeq: number } \| { kind: 'FULL' }>` | `packages/runtime/src/facade.ts` | **MISSING** |
| `hasSubmitCommand` | `(orderId: string) => Promise<boolean>` | `packages/runtime/src/facade.ts` | **MISSING** |
| `cancelOrder` | `(symbol: string, orderId: string) => Promise<'ACCEPTED' \| 'FULL' \| 'UNKNOWN_SYMBOL' \| 'CLOSED'>` | `packages/runtime/src/facade.ts` | **MISSING** |
| `haltSymbol` | `(symbol: string) => Promise<void>` | `packages/runtime/src/facade.ts` | **MISSING** |
| `resumeSymbol` | `(symbol: string) => Promise<void>` | `packages/runtime/src/facade.ts` | **MISSING** |
| `openAccount` | `(accountId: string, requestId: string) => Promise<void>` | `packages/runtime/src/facade.ts` | **MISSING** |
| `deposit` | `(accountId: string, asset: string, amount: bigint, requestId: string) => Promise<void>` | `packages/runtime/src/facade.ts` | **MISSING** |
| `riskView` | `(accountId: string) => RiskSnapshot` | `packages/runtime/src/facade.ts` | **MISSING** |
| `internalTrades` | `(fromTs: number, toTs: number) => Promise<Trade[]>` | `packages/runtime/src/facade.ts` | **MISSING** |
| `ledgerSnapshot` | `() => Promise<Map<string, bigint>>` | `packages/runtime/src/facade.ts` | **MISSING** |

## Journal Query Interface (PgJournal)

**File:** `packages/journal/src/pg-journal.ts`

```ts
interface PgJournal {
  append(batch: readonly unknown[]): Promise<void>
  appendEvents(batch: readonly ShardOutput[]): Promise<void>
  lastCommandSeq(symbol: string): Promise<number>
  readCommands(symbol: string, fromSeq: number, chunkSize: number): Promise<readonly { seq, ts, command }>
  readEvents(symbol: string, fromSeq: number, toSeq: number): Promise<readonly { seq, ts, payload }>
}
```

## order_owners Queries

**File:** `packages/risk/src/persistence/order-owners.ts`

```ts
class OrderOwnerStore {
  async insertOwner(owner: OrderOwner): Promise<{ inserted: boolean }>
  async lookupMany(orderIds: readonly string[]): Promise<Map<string, OrderOwner>>
}
```

## order_requests Queries

**File:** `packages/journal/src/order-request-store.ts`

```ts
class OrderRequestStore {
  async register(
    accountId: string,
    clientOrderId: string,
    orderId: string,
    payloadJson: unknown
  ): Promise<{ result: 'CREATED' | 'DUPLICATE' | 'CONFLICT', orderId: string }>
}
```

## Journal Indexes from Migration 007

**File:** `packages/journal/migrations/007_journal_indexes.sql`

All use `payload_json` paths (real, queryable):

| Index | Filter | Path | Payload Type |
|-------|--------|------|--------------|
| `journal_cmd_order` | `record_type = 'COMMAND'` | `payload_json->>'orderId'` | Command orderId |
| `journal_evt_order` | `record_type = 'EVENT'` | `payload_json->>'orderId'` | Event orderId |
| `journal_evt_taker` | `record_type = 'EVENT'` | `payload_json->>'takerOrderId'` | Trade takerOrderId |
| `journal_evt_maker` | `record_type = 'EVENT'` | `payload_json->>'makerOrderId'` | Trade makerOrderId |
| `journal_evt_type` | `record_type = 'EVENT'` | `(payload_json->>'type'), seq` | Event type + seq |

## System Endpoints (Demo/Admin)

**File:** `packages/api/src/routes/system.ts` and `packages/api/src/routes/admin.ts`

### Simulator Control (Demo Only)

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/system/simulator` | `GET` | Get simulator status (running, scenario, rate, counters) | `{ running, scenario, ratePerSec, counters: { sent, backedOff } }` |
| `/system/simulator/start` | `POST` | Start simulator (creates account, deposits, starts flows) | `{ running: true, scenario, ratePerSec }` |
| `/system/simulator/stop` | `POST` | Stop simulator gracefully | `{ running: false }` |

### Chaos Testing (Demo Only)

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/admin/demo/chaos/kill/:symbol` | `POST` | Kill shard for symbol (triggers failover) | `{ action: 'kill', symbol, status: 'queued' }` |
| `/admin/demo/chaos/freeze/:symbol` | `POST` | Freeze shard for symbol (SIGSTOP, pauses processing) | `{ action: 'freeze', symbol, status: 'queued', resumeAt: timestamp }` |

### System Status Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/system/invariants` | `GET` | Check system invariants (ledger zero-sum, positions, etc.) | `{ valid, ledgerZeroSum, positionsZeroSum, noNegativeAvailable, projectionsEqualRisk }` |
| `/system/health` | `GET` | Health check (projector lag, pipeline state) | `{ status, projectorLagSeq, pipelineState, ts }` |
| `/system/shards` | `GET` | Shard status and lease information | `{ shards: [{ leaseId, owner, epoch, isStale, lastSeq, ... }] }` |
| `/system/recovery` | `GET` | Recovery operation history | `{ recoveries: [{ leaseId, durationMs, snapshotSeq, tailLength, ... }] }` |
| `/system/metrics/summary` | `GET` | Aggregated metrics from Prometheus | `{ available, commandsPerSec, latencyMs: { p50, p95, p99 }, ... }` |

## Internal Risk Modules (no HTTP surface)

| Module | Purpose |
|---|---|
| `packages/risk/src/dedupe-bounds.ts` | Bounds the risk journal's dedupe set: live order ids are kept forever, decided ids are kept for `DEDUPE_WINDOW_SEQ` (default in `@matchledger/common`'s `DEFAULT_DEDUPE_WINDOW_SEQ`), older decided ids are evicted on snapshot. Not an API facade; internal to risk-partition recovery/snapshotting. |
| `packages/risk/src/orders-submitted-consumer.ts` | Consumes `orders.submitted` messages and journals them through `FencedPgJournal` (lease id `risk-<partition>`), storing the consumer offset in the same transaction as the journal write. Not an API facade; internal transport-to-journal wiring for a risk partition. |


## Runnable startup composition (2026-10-31)

- `packages/api/src/main.ts::startApi()` loads validated HTTP/startup config,
  holds the control-plane advisory lock on a dedicated connection, runs journal
  migrations, creates the live runtime, optionally seeds the demo profile, catches
  up and starts the real projector, starts HTTP and the separate metrics listener,
  and returns `{ app, close, graceMs }`. Shutdown stops simulator production,
  closes HTTP/WebSocket connections, drains the runtime and projector, closes
  metrics, releases the advisory lock, and closes the pool. The CLI handles
  SIGTERM/SIGINT, a second signal, fatal exceptions, and the grace deadline.
- `@matchledger/runtime::createLiveRuntime({ sql, instruments, queueCapacity,
  maxBatch, heartbeatMs, transport?, brokers?, shardPartitions?, onFatal })` returns the existing API facade methods
  (`submitOrder`, `hasSubmitCommand`, `cancelOrder`, `haltSymbol`, `resumeSymbol`,
  `deposit`, `riskView`, `internalTrades`) plus `riskConfig` and `stop()`.
  It composes the real risk recovery/core/journal, matching runner, event router,
  and durable ledger. A FULL result does not become a 202. Engine events missing
  after a command-only crash are regenerated; stored events are checked against
  replay, and deposit ledger writes catch up idempotently. In inproc mode it owns matching. In Kafka mode it publishes accepted commands
  to orders.accepted, consumes engine.events, validates outputs against the
  database journal, and routes real risk notices and ledger postings. Both modes
  recover risk and router state and write control-plane recovery_log rows.
- `@matchledger/shard::createPostgresRunner(...)` acquires a real lease, recovers
  matching engines from the real command journal, validates/regenerates outputs,
  and returns `{ runner, epoch, heartbeat, sequences, books }`. It uses the
  existing ShardRunner loop unchanged. `decodeEngineCommand` and `journalJson`
  adapt persisted engine commands and bigint JSON at the I/O boundary.
- `@matchledger/risk::PgRiskJournal` is exported for composition; its append and
  recovery contracts are unchanged.
- `packages/shard/src/main.ts::startShard()` composes real leases, recovery,
  matching runner factories, Kafka sinks, offsets, heartbeats and recovery logs.
  It observes actual consumer assignments and revokes/drains runners on ownership
  changes. Invalid historical messages are published to `dlq.orders.accepted`
  before their offset advances. `scripts/create-topics.mjs` creates that topic.
- `PartitionConsumer.assignments()` exposes the client's current topic/partition
  assignment to startup lifecycle wiring. `KafkaEventSink` accepts an optional
  stable per-lease transactional id to fence old partition owners.
- Simulator submission goes through authenticated `POST /orders` via
  Fastify injection, including its body validation, account lookup, RBAC,
  idempotency registration, durability and FULL/503 handling. The demo-profile
  simulator principal/account is seeded with the other demo users. Generated
  prices are converted to decimal strings before entering the HTTP contract.
- WebSocket subscriptions poll authenticated read endpoints for full snapshots;
  private order snapshots use the subscribing token's account scope. Snapshots
  have a per-connection epoch and increasing sequence. This is bounded polling,
  not a claim of an event-notice fan-out implementation.


### Live completion additions (2026-10-31)

- API startup validates TRANSPORT=inproc|kafka, KAFKA_BROKERS,
  SHARD_PARTITIONS, METRICS_HOST and REBUILD_PROJECTIONS. The last flag is an
  explicit, ownership-locked rebuild of derived tables from preserved journals.
- `recoverRiskPartition({ ..., upToSeq? })` supports bounded independent replay.
  Verify-replay ignores stored snapshot candidates during the scratch replay and
  verifies both the canonical stored payload and its comparison checksum.
- `PartitionConsumer` accepts validated startup session/poll timeouts,
  fromBeginning and an onAssignmentLost callback. Shards fail-stop on lost
  assignments or stale leases. A worker-thread watchdog stops the entire shard
  when its event loop exceeds the configured poll interval, including native
  heartbeats that a timer on the blocked loop cannot stop.
- Demo shards subscribe to control.commands for KillShard and bounded FreezeShard;
  production shards do not register this consumer. The Kafka demo API owns and
  closes its control producer.
- `/orders/{id}/events` reads the journal, returns ISO timestamps, typed payloads
  and normalized rejection display amounts. Reconciliation sorts by real columns;
  JSONB rejection snapshots are accepted without parsing an object as JSON text.
- Migration startup serializes on a schema-scoped advisory lock. The three known
  Week 11 renames are adopted only when their checksums match existing history;
  modified migrations still fail. No historical migration SQL was rewritten.

`GET /system/shards` also returns `chaosEnabled`, true only when the demo control producer is wired. P7 uses this capability and routes chaos by an actual owned symbol rather than a lease-id suffix; inproc mode keeps simulator controls but hides unsupported shard chaos actions.

## Verification limits — 2026-10-31

Current results and the assertion-aware ID/skip inventories are linked from PROGRESS.md. Projector lag is recorded in journal sequence units as `ml_projector_lag` in both the API helper and telemetry catalogue; it is not a duration metric. `VITE_POLL_INTERVAL_MS` is validated by the browser config module and defaults to 5000 ms. Hand-authorship of `stream-state.ts` cannot be certified: the reducer was AI-written during this conversation.

### Hosting readiness and bounded API startup

`GET /healthz` is public and database-backed on the API listener after startup recovery and projector catch-up. It returns `{ status: "ready" }` or HTTP 503 `{ status: "unavailable" }`, with no-store caching. Business endpoints retain authentication. `createPool` accepts optional `connectionTimeoutMillis` and `statementTimeoutMs`; API startup supplies validated `DB_CONNECT_TIMEOUT_MS` and `DB_STATEMENT_TIMEOUT_MS` from startup config. The CLI uses `API_STARTUP_TIMEOUT_MS` to exit a stalled startup and logs the last startup phase. Failed initial connection attempts now close the pool; the ownership connection is destroyed during cleanup to release its session advisory lock.

API ownership acquisition now waits within validated `API_OWNERSHIP_WAIT_MS` and `API_OWNERSHIP_RETRY_MS` limits (`packages/api/src/runtime-ownership.ts`). It does not begin recovery until exclusive ownership is acquired and never evicts another owner. Render overlapping deployment still requires the old single-writer instance to stop; bounded retries do not bypass readiness or ownership.
