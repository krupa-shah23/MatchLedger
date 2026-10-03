# Version verification`n`n`npm view` before pinning: TypeScript 7.0.2 (no peers), Vitest 5.0.3 (Vite 6–8 / Node 24), fast-check 4.10.2 (no peers). Required-range pins: TypeScript 6.0.3, Vitest 4.1.11, fast-check 4.10.2.

## Installed top-level snapshot

``text
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
``


## Step 3 infrastructure
- Compose pins: postgres:18, redis:8, apache/kafka:4.2.2, prom/prometheus:v3.11.2, grafana/grafana:13.1.3. Docker CLI is unavailable on this host, so pull/up/health and PostgreSQL integration remain pending.
- Kafka client 1.10.1: dynamic import succeeded on this host without compilation. npm reported its install script pending approval, but the prebuilt import loads.
- Spike 1: tinybench hello benchmark added and invoked through @matchledger/benchmarks bench.
- Spike 7 partial: money codec and fast-check JSON property P10 pass; PostgreSQL int8 parser and integration helper added, execution pending Docker.

## Day-1 checklist (4.6)
- [ ] Node 24/npm 11 host check (host currently uses its configured Node; CI pins 24)
- [x] tsc -b builds all workspaces
- [ ] npm view every verify row (only relevant Step 1–3 packages checked)
- [ ] compose pull/up health (Docker unavailable)
- [x] Kafka client import
- [x] Spike 1 tinybench
- [x] Spike 2 purity lint
- [ ] Spike 3 Testcontainers
- [ ] Spike 4 Kafka transactions
- [ ] Spike 5 Fastify/JWT/WebSocket
- [ ] Spike 6 Redis/money codec
- [ ] Spike 7 PostgreSQL runtime round trip (codec JSON portion done)



## Spike 3
- Added packages/journal/src/postgres.integration.test.ts, which uses PostgreSqlContainer('postgres:18') when RUN_CONTAINERS=1 and asserts 9007199254740993n survives an int8 query.
- Testcontainers 12.2.0 / @testcontainers/postgresql 12.2.0 were requested, but npm did not materialize either package in this environment; Docker is also unavailable. The integration execution is pending; compose fallback is impossible on this host.

## Spike 4
- Local Kafka client docs inspected: KafkaJS.Kafka, producer.transaction(), transaction send, commit, bort, and sendOffsets({ consumer, topics }) are the current API names. 	ransactional.id, nable.idempotence: true, cks: -1, group.protocol: classic, nable.auto.commit: false, and isolation.level: read_committed are used by packages/shard/src/spike4.ts.
- Consumer revoke/lost handling uses librdkafka ebalance_cb; package docs identify it as the only supported consumer callback, with rebalance events including revoked partitions. ErrorCodes.ERR__FENCED is the documented expected producer-fencing code.
- Live proofs a–d require Kafka at localhost:29092 and remain pending because Docker/Kafka is unavailable. The runnable probe and opt-in test are present; it must verify committed visibility, transactional sendOffsets, aborted invisibility, and same-id fencing/error code when infrastructure is available.

