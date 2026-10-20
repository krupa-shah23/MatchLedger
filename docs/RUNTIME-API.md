# Runtime Facade API (Week 9 Inventory)

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
