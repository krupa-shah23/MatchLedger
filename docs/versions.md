# Version verification

This file mixes dated historical environment snapshots with the current dependency-pin check near the end. Historical command outputs are not all retained; do not treat those snapshots as current verification.

## Week 9 Pinned Dependencies (Day 0-1)

Verified peer dependencies:
- fastify 5.10.0 (no peers) → packages/api
- @fastify/websocket 11.3.2 (peer: fastify@5.x) → packages/api ✓
- @fastify/multipart 10.1.4 (peer: fastify@5.x) → packages/api ✓
- jose 6.2.12 (no peers) → packages/api
- zod 4.6.7 (no peers) → packages/common
- prom-client 15.1.3 (no peers) → packages/api
- ws 8.22.0 (optional peers: bufferutil, utf-8-validate) → packages/api
- @types/ws 8.18.2 (no peers, dev) → packages/api

**Compatibility check:** All @fastify/* plugins require Fastify 5.x; pinned 5.10.0 satisfies both.

## Pure-Zone ESLint Rules (4.12)

Applied to `packages/projections/src/order-facts.ts` and `mappers.ts` via eslint.config.js:

**Proof of enforcement** (test violations):
```
/home/krupa-shah/Desktop/MatchLedger/packages/projections/src/order-facts.ts
  1:1   error  'node:crypto' import is restricted from being used by a pattern. node:* imports are forbidden in the pure zone  no-restricted-imports
  3:10  error  Unexpected use of 'Date'. Time is an input                                                                      no-restricted-globals
```

**Ban list** (same as recon/src/core):
- node:* imports forbidden
- Date, Math.random, setTimeout, crypto, fetch, process, performance forbidden
- async/await and Promise forbidden
- Only relative imports and type-only @matchledger/common allowed

npm view before pinning: TypeScript 7.0.2 (no peers), Vitest 5.0.3 (Vite 6–8 / Node 24), fast-check 4.10.2 (no peers). Required-range pins: TypeScript 6.0.3, Vitest 4.1.11, fast-check 4.10.2.

## Installed top-level snapshot (historical Windows environment)

```text
matchledger@0.1.0 D:\College\Projects - Resume\sde
├─┬ @matchledger/api@0.1.0 -> .\packages\api
│ ├── @matchledger/common@0.1.0 deduped -> .\packages\common
│ ├── @matchledger/journal@0.1.0 deduped -> .\packages\journal
│ ├── @matchledger/projections@0.1.0 deduped -> .\packages\projections
│ ├── @matchledger/recon@0.1.0 deduped -> .\packages\recon
│ └── @matchledger/risk@0.1.0 deduped -> .\packages\risk
├─┬ @matchledger/benchmarks@0.1.0 -> .\packages\benchmarks
│ └── @matchledger/engine-core@0.1.0 deduped -> .\packages\engine-core
├─┬ @matchledger/common@0.1.0 -> .\packages\common
│ └── @matchledger/engine-core@0.1.0 deduped -> .\packages\engine-core
├── @matchledger/engine-core@0.1.0 -> .\packages\engine-core
├─┬ @matchledger/journal@0.1.0 -> .\packages\journal
│ ├── @matchledger/common@0.1.0 deduped -> .\packages\common
│ └── @matchledger/engine-core@0.1.0 deduped -> .\packages\engine-core
├─┬ @matchledger/ledger@0.1.0 -> .\packages\ledger
│ ├── @matchledger/common@0.1.0 deduped -> .\packages\common
│ └── @matchledger/journal@0.1.0 deduped -> .\packages\journal
├─┬ @matchledger/projections@0.1.0 -> .\packages\projections
│ └── @matchledger/common@0.1.0 deduped -> .\packages\common
├─┬ @matchledger/recon@0.1.0 -> .\packages\recon
│ ├── @matchledger/common@0.1.0 deduped -> .\packages\common
│ └── @matchledger/journal@0.1.0 deduped -> .\packages\journal
├─┬ @matchledger/risk@0.1.0 -> .\packages\risk
│ ├── @matchledger/common@0.1.0 deduped -> .\packages\common
│ └── @matchledger/journal@0.1.0 deduped -> .\packages\journal
├─┬ @matchledger/shard@0.1.0 -> .\packages\shard
│ ├── @matchledger/common@0.1.0 deduped -> .\packages\common
│ ├── @matchledger/engine-core@0.1.0 deduped -> .\packages\engine-core
│ └── @matchledger/journal@0.1.0 deduped -> .\packages\journal
├─┬ @matchledger/simulator@0.1.0 -> .\packages\simulator
│ └── @matchledger/common@0.1.0 deduped -> .\packages\common
├─┬ @matchledger/web@0.1.0 -> .\web
│ └── @matchledger/common@0.1.0 deduped -> .\packages\common
├── fast-check@4.10.2
├── typescript@6.0.3
└── vitest@4.1.11
```
## Step 3 infrastructure (historical checkpoint)
- The earlier checkpoint listed major-only PostgreSQL and Redis image tags and said Docker was unavailable at that time. Current `docker-compose.yml` pins `postgres:18.6`, `redis:8.8.4`, `apache/kafka:4.2.2`, `prom/prometheus:v3.11.2`, and `grafana/grafana:13.1.3`; current daemon health was not verified in this continuation.
- Kafka client 1.10.1: dynamic import succeeded on this host without compilation. npm reported its install script pending approval, but the prebuilt import loads.
- Spike 1: tinybench hello benchmark added and invoked through @matchledger/benchmarks bench.
- Spike 7 partial: money codec and fast-check JSON property P10 pass; PostgreSQL int8 parser and integration helper added, execution pending Docker.

## Day-1 checklist (4.6)
- [ ] Node 24/npm 11 host check (host currently uses its configured Node; CI pins 24)
- [x] tsc -b builds all workspaces
- [x] npm view every verify row (see section above)
- [ ] compose pull/up health (verified by the CI integration job; not run locally)
- [x] Kafka client import
- [x] Spike 1 tinybench
- [x] Spike 2 purity lint
- [ ] Spike 3 Testcontainers (verified by the CI integration job; not run locally)
- [ ] Spike 4 Kafka transactions (verified by the CI integration job; not run locally)
- [x] Spike 5 Fastify/JWT/WebSocket
- [ ] Spike 6 Redis/money codec (offline part done; live part pending CI)
- [ ] Spike 7 PostgreSQL runtime round trip (offline part done; live part pending CI)



## Spike 3
- Added packages/journal/src/postgres.integration.test.ts, which uses PostgreSqlContainer('postgres:18') when RUN_CONTAINERS=1 and asserts 9007199254740993n survives an int8 query.
- Testcontainers 12.2.0 / @testcontainers/postgresql 12.2.0 were requested, but npm did not materialize either package in this environment; Docker is also unavailable. The integration execution is pending; compose fallback is impossible on this host.

## Spike 4
- Local Kafka client docs inspected: KafkaJS.Kafka, producer.transaction(), send, commit, abort, and sendOffsets({ consumer, topics }) are the current API names. transactional.id, enable.idempotence: true, acks: -1, group.protocol: classic, enable.auto.commit: false, and isolation.level: read_committed are used by packages/shard/src/spike4.ts.
- Consumer revoke/lost handling uses librdkafka rebalance_cb; package docs identify it as the only supported consumer callback, with rebalance events including revoked partitions. ErrorCodes.ERR__FENCED is the documented expected producer-fencing code.
- Live proofs a–d require Kafka at localhost:29092 and remain pending because Docker/Kafka is unavailable. The runnable probe and opt-in test are present; it must verify committed visibility, transactional sendOffsets, aborted invisibility, and same-id fencing/error code when infrastructure is available.

## Spikes 5–7

- 
pm view` verification on 9 October 2026:
  - `fastify`: current `5.12.5`; pinned `5.10.0` as required by the blueprint.
  - `@fastify/websocket`: current `11.3.3`; pinned `11.3.2`, the Fastify 5-compatible major.
  - `jose`: current `6.2.12`; pinned `6.2.12`.
  - `ws`: current `8.22.0`; pinned `8.22.0`.
  - `redis`: current `6.3.0`; pinned `4.7.1` for the node-redis client used by the spike.
  - `pg`: current `8.23.1`; pinned `8.23.1`.
- Spike 5 local proof passes without Docker: `/health`, valid HS256 JWT, expired JWT rejection, missing-token rejection, WebSocket auth timeout, and valid WebSocket auth acknowledgement. The WebSocket timeout is configurable and the test uses 150 ms. `prom-client` was not installed.
- Spike 6 local proof passes without Redis: the common money codec stores bigint as a decimal string and restores it identically, including values above `Number.MAX_SAFE_INTEGER` and both money bounds. The Redis client set/get test is opt-in.
- Spike 7 local JSON/codec proof passes without services. The full JSON -> PostgreSQL int8 -> Redis -> money codec chain is opt-in and uses `RUN_INTEGRATION=1`; its values include `9007199254740993n`, `-9007199254740993n`, `MIN_MONEY`, `MAX_MONEY`, and `0n`.
- Default 
pm run test` result: 11 passed, 4 skipped. Skipped live-service tests are the Spike 3 PostgreSQL container test (`RUN_CONTAINERS=1`), Spike 4 Kafka live test (`RUN_KAFKA_SPIKE=1`), Spike 6 Redis integration test (`RUN_INTEGRATION=1`, `RUN_CONTAINERS=1`, or `RUN_REDIS_SPIKE=1`), and Spike 7 PostgreSQL/Redis chain test (`RUN_INTEGRATION=1` or `RUN_CONTAINERS=1`).
- Live verification for Spikes 3, 4, 6, and 7 is configured in `.github/workflows/ci.yml` after the regular `verify` job. These services were not started or tested locally because Docker is unavailable. Spike 5 and all non-service portions of Spikes 6–7 are proven locally.
- Required local checks all pass: 
pm run build`, 
pm run lint`, 
pm run check:boundaries`, and 
pm run test`.

## Enforcement proof (T7/T8), run locally
- Lint on a temporary file in engine-core/src (file removed afterwards): `Date.now()` -> no-restricted-globals + no-restricted-properties; `Math.random()` -> no-restricted-properties; `async`/`await` -> no-restricted-syntax (2 errors); `import "node:fs"` -> no-restricted-imports.
- Boundary script with `"dependencies": {"zod": "4.6.5"}` temporarily added to engine-core (reverted): "dependencies.zod is forbidden (allowed: none)" and "engine-core dependencies must be exactly {}". Clean tree: "Dependency boundaries verified for all workspaces."

## npm view of remaining verify rows (2026-10-10)
@fastify/websocket 11.3.4; pg 8.23.1; redis 6.3.0; jose 6.2.12; zod 4.6.5; prom-client 15.1.3; tinybench 6.2.1; @testcontainers/postgresql 12.2.0 (not used: Spike 3 uses compose Postgres); @fastify/swagger-ui 6.1.2 (not installed); ws 8.22.0; node-pg-migrate 9.0.0 (not installed). Installed pins are in package.json files.

## Week 11 React UI Dependencies (1.4)

Verified npm view output (2026-10-19):

| Package | Version | Peer Dependencies | Status |
|---------|---------|-------------------|--------|
| react | 19.3.1 | none | ✓ |
| react-dom | 19.3.1 | react@^19.3.1 | ✓ |
| react-router-dom | 7.18.4 | react>=18, react-dom>=18 | ✓ |
| @tanstack/react-query | 5.104.5 | react^18\|^19, @types/react^18\|^19 | ✓ |
| vite | 8.3.4 | none (optional peers) | ✓ |
| vitest | 4.1.11 | (already pinned Week 9) | ✓ |
| @vitest/ui | 5.0.5 | vitest@5.0.5 | ✓ |
| @testing-library/react | 16.3.3 | react^18\|^19, react-dom^18\|^19 | ✓ |
| happy-dom | 21.0.3 | none | ✓ |
| jsdom | 30.1.3 | canvas@^3.2.3 (optional) | ✓ |
| typescript | 7.0.2 | (already pinned) | ✓ |
| eslint | 10.13.0 | jiti (optional) | ✓ |
| @typescript-eslint/eslint-plugin | 8.72.0 | eslint^8.57\|^9\|^10, typescript>=4.8.4 <6.1, parser@^8.72.0 | ✓ |
| @typescript-eslint/parser | 8.72.0 | eslint^8.57\|^9\|^10, typescript>=4.8.4 <6.1 | ✓ |
| eslint-plugin-react-hooks | 7.1.1 | eslint^3-10 | ✓ |

**Pin decision for web/package.json:**
```json
{
  "dependencies": {
    "@matchledger/common": "file:../packages/common",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "react-router-dom": "7.18.4",
    "@tanstack/react-query": "5.104.5"
  },
  "devDependencies": {
    "vite": "8.3.4",
    "@vitest/ui": "5.0.5",
    "@testing-library/react": "16.3.3",
    "happy-dom": "21.0.3"
  }
}
```

**Additional Week 11 packages (verified 2026-10-20):**

| Package | Version | Status |
|---------|---------|--------|
| @testing-library/user-event | 14.6.1 | ✓ |
| @testing-library/jest-dom | 6.6.3 | ✓ |
| @vitejs/plugin-react | 4.3.3 | ✓ |
| @playwright/test | 1.48.0 | ✓ |
| prom-client | 15.1.3 | ✓ (reused from Week 9) |

**Rationale:**
- React 19 latest stable; peer satisfied by all ecosystem packages
- React Router 7 latest; requires React >= 18 (satisfied)
- TanStack Query 5 latest; supports React 19 + TypeScript types
- Vite 8 latest; Vitest 4 compatible
- happy-dom for jsdom-free unit tests (lighter than jsdom)
- @testing-library/react 16 latest compatible with React 19
- Playwright 1.48.0 for E2E testing
- prom-client 15.1.3 for telemetry metrics (already in use from Week 9)

## Week 3 benchmark dependency check
Command: `npm view tinybench version peerDependencies`

Observed latest version: `6.2.1`; peer dependencies: none. The benchmark
workspace is pinned to exact version `6.2.1`.

## Spike 4 results
- Client version: `@confluentinc/kafka-javascript` 1.10.0
- librdkafka version: 2.15.0
- Broker: `apache/kafka:4.2.2` via Docker Compose; broker health confirmed, KRaft mode active, transaction state log replication 1 / min ISR 1.
- Real API names validated against the installed package:
  - Producer creation: `const { Kafka } = KafkaJS; const producer = kafka.producer({ "transactional.id": txId, "enable.idempotence": true, kafkaJS: { acks: -1 } });`
  - Transaction start: `await producer.transaction()`
  - Transaction commit: `await tx.commit()`
  - Transaction abort: `await tx.abort()`
  - Offset commit inside a transaction: `await tx.sendOffsets({ consumer, topics })`
  - Consumer config: `"group.protocol": "classic"`, `"enable.auto.commit": false`, `"isolation.level": "read_committed"`
  - Rebalance callback: the library exposes the low-level librdkafka callback as `rebalance_cb`, and the callback receives the current rebalance state plus the revoked/assigned/lost partitions in the underlying client event payload.
- Live broker outputs from `RUN_KAFKA_SPIKE=1 node --experimental-strip-types src/spike4.ts`:
  - T10 read_committed sees: `[ 'committed' ]`
  - T12 after abort (expect no 'aborted'): `[ 'committed' ]`
  - T11 output topic: `[ 'processed:committed' ]`
  - T13 fenced: `{ name: 'KafkaJSError', code: -152, message: 'Local: Purged in queue' }`
  - T14 rebalance_cb -175 [ { topic: 'spike4-in-...', partition: 0 } ]
  - T14 rebalance_cb -174 [ { topic: 'spike4-in-...', partition: 0 } ]
- Exact producer-fencing failure observed on the first producer:
  - call: `await tx.commit()` on the stale producer after a second producer re-used the same `transactional.id`
  - error name: `KafkaJSError`
  - code: `-152`
  - message: `Local: Purged in queue`
- Decision / deviation: no blueprint conflict was observed. The installed client uses KafkaJS-compatible names in the `kafkaJS` config block, but the underlying consumer rebalance hook is the librdkafka callback name `rebalance_cb`, and the producer-fencing error arrives as `KafkaJSError` with code `-152`.


## Live composition completion — 2026-10-31

No new external library was introduced. API composition now directly declares the
existing local `@matchledger/transport` workspace (0.1.0); its Kafka client remains
pinned to `@confluentinc/kafka-javascript` 1.10.0. The fail-stop watchdog uses Node's
built-in worker_threads module. Dockerfile.shard pins its Node 24 Alpine base by
digest `sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85`.
Prometheus v3.11.2 and Grafana 13.1.3 pins are unchanged.

## Dependency pin follow-up — 2026-10-31

Current exact pins after the advisory review: Fastify `5.12.7`, Vitest `4.1.12`, happy-dom `21.0.4`, TypeScript `6.0.3` in both root and web, and Zod `4.6.7` in common and shard. `npm ci` reproduced the lockfile. The old Windows installed-tree snapshot above remains historical evidence only and was not reproduced on this host.

`npm audit` now reports 10 moderate findings and no high or critical findings. The remaining findings are in the ESLint / typescript-eslint / minimatch development-tool dependency chain. npm's suggested remediation downgrades `typescript-eslint` to `8.14.0` or ESLint to `4.0.0`, which is incompatible with the configured ESLint 10 flat config; `npm audit fix` reports it would require `--force`. No forced downgrade or major break was applied. Fastify, Vitest, happy-dom, and fast-uri received compatible fixes. Zod in `packages/shard` was upgraded from 3 to 4 to match the already-used common-package version and clear the high advisory; its build and tests pass.

## Week 12 deployment image pins — 2026-10-31

- Caddy `2.10.2-alpine`, pinned in `deploy/Dockerfile.proxy` to digest `sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d`; pulled and validated against `deploy/Caddyfile` with `caddy validate`.
- Node `24-alpine`, pinned by digest `sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85` in both new deployment build stages.
- The benchmark result schema uses the already-pinned Zod `4.6.7`, now declared directly by `@matchledger/benchmarks`; no new external package was added for the runner or renderers.

## Week 12 load-generator dependency — 2026-10-31

- `@matchledger/simulator` now directly pins `@confluentinc/kafka-javascript` `1.10.0` for the isolated `src/load` Kafka generator. This is the exact client version recorded and API-checked in Spike 4; the root lockfile was updated with `npm install --package-lock-only --ignore-scripts --offline --workspace @matchledger/simulator`.
- The load script uses the official `grafana/k6:1.7.0` image. `docker pull grafana/k6:1.7.0` resolved the versioned tag to digest `sha256:ae824aa6906ce242156163462367cbcba7065efc2d365969ae41b282f1acc9f5`; the five-second, one-arrival-per-second dry run passed with the `http_req_failed` and `dropped_iterations` thresholds green.
