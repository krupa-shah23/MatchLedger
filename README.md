# MatchLedger

MatchLedger is a deterministic, event-sourced trading and settlement engine built with Node.js and TypeScript.

## Run the seeded local demo

Requirements: Node 24, npm workspaces, Docker Compose, and Playwright browsers.

```bash
docker compose up -d postgres redis kafka
npm ci
npm run build
# First run only; omit this command if the database already exists:
docker compose exec postgres createdb -U postgres matchledger_demo
```

Start the API in one terminal (JWT_SECRET is loaded from your local `.env`):

```bash
DATABASE_URL=postgres://postgres:matchledger@localhost:5432/matchledger_demo npm run demo:api
```

Start React in another terminal:

```bash
npm run dev --workspace @matchledger/web
```

Open http://localhost:5173. Demo users are `demo-trader`, `demo-risk`,
`demo-ops`, and `demo-admin`; the demo-profile password is `demo-password`.
Seeding is idempotent and runs funds through the durable runtime, without
clearing journals. Metrics are on http://localhost:3001/metrics. Grafana's
Compose host port is 3002, leaving port 3000 for the API.

Run all six demo scenarios in Chromium, Firefox and WebKit:

```bash
npm run test:e2e -- --reporter=line
```

The API supports `TRANSPORT=inproc` (default) and `TRANSPORT=kafka`.
For Kafka mode, create topics with `node scripts/create-topics.mjs`, start
`npm run shard:start` with `TRANSPORT=kafka`, `SHARD_ID`, `DATABASE_URL`, and
`KAFKA_BROKERS`, then start the API with the same database and broker settings.
Stop the Compose shards before using separately configured standalone shards;
every member of a matching consumer group must use the same database.
The API owns risk and ledger processing; shards own matching. Run only one
API per database. Never run the in-process matching engine alongside Kafka
matching shards against the same symbol streams.

`docker compose up -d --build shard-0 shard-1 prometheus grafana` provisions
shard metrics, the Prometheus scrape configuration and Grafana's dashboard.
Prometheus is on port 9090; Grafana is on port 3002. Anonymous Grafana access
is disabled unless explicitly enabled with `GRAFANA_ANONYMOUS_ENABLED=true`
for a demo. The host API metrics listener must be reachable on port 3001.

For an existing demo database with old read models, start the API once with
`REBUILD_PROJECTIONS=1`. This rebuilds derived projection tables from preserved
journals while holding the API ownership lock; it does not delete journal or
ledger entries. Restart normally afterwards.

Live verification commands (use an isolated Kafka broker for chaos tests):

```bash
RUN_INTEGRATION=1 RUN_LIVE_STACK=1 LIVE_KAFKA_BROKERS=localhost:39092 npm run test:integration
E2E_PASSWORD=demo-password node scripts/verify-empty-pages.mjs
E2E_PASSWORD=demo-password xvfb-run -a node scripts/verify-page-visibility.mjs
```

## Limitations

Current verification results and open findings: [PROGRESS.md](PROGRESS.md). Passing runtime gates do not certify the manual browser demo or hand-authorship. The reducer was AI-written during this conversation.

- **Single API instance.** There is no multi-instance fan-out for WebSocket connections or horizontal scaling of the API process; running more than one instance behind a load balancer is not supported.
- **No mobile layout.** The web UI targets desktop viewports only; it has not been laid out or tested for phone/tablet screens.
- **Latency numbers are valid on one host only.** Any latency figures in this repo's docs were measured with the engine, risk, API and database colocated on a single machine; they do not reflect cross-host network latency in a real multi-machine deployment.

## Recovery (Week 8, historical — current verification notes are in PROGRESS.md)

The source documents conflict: `WEEK-8-COMPLETE.md` records 317 passed, 96 skipped, 4 todo and 122 Week 8 tests; `WEEK-8-TEST-AUDIT.md` says 104 in its table (113 in its heading) and records 313 passed, 96 skipped, 4 todo; `WEEK-8-STATUS.md` records 285 passed, 92 skipped, 23 todo and marks parts of the pipeline partial; `WEEK-8-VERIFICATION.md` records 205 passed, 78 skipped, 3 todo for both unit and integration; and `docs/audits/WEEK-8-AUDIT.md` is an earlier checkpoint that says Week 8 tests did not exist. The original run logs are absent. A new isolated reproduction on archived commit `a54ace6e930efa9cd72e32b07c4cdd0fc693bf1b` did reproduce `npm test` at 317 passed, 96 skipped, 4 todo on 2026-10-31. Its archived lockfile was incomplete (`npm ci` rejected the missing `@matchledger/runtime` entry), so the isolated reproduction used `npm install` before running; this verifies the source snapshot's current unit-suite count, not the historical run event. The Week 8-specific total (122 vs. the other records' 104/113) and the original property/chaos execution totals remain **UNVERIFIED**.

**Durability Claim:** Kill the system at any point between or within the engine and risk stages, restart, and the final state (order books, reservations, balances, ledger, events) equals the uninterrupted run, with no lost order, no duplicate order, and no stranded reservation.

**Claimed in the later Week 8 record:** Single risk partition, single shard, sequential + concurrent order flows with deterministic crash injection (RCP1-RCP7). The overall suite count was reproduced at the archived commit. The claimed 122 Week 8-specific tests across 14 categories remains unverified because the retained category totals disagree.

**Subsystems:**
- ✅ Engine recovery: snapshot + tail replay, event regeneration (Week 5, unchanged)
- ✅ Risk recovery: snapshot + tail, dedupe sets + halted symbols survive restore, redelivery via engine journal, notice catch-up
- ✅ Ledger recovery: atomic appends, idempotent catch-up from deposits/adjustments/trades, balance invariants verified
- ✅ Recon recovery: optimistic transitions, audit trail, idempotent by file hash
- ✅ Router recovery: owner map restored, MarketView rebuilt from book, watermark set to engine's last seq
- ✅ Codecs: strict (unknown type throws), versioned (v:1), exhaustive (adding new type fails to compile), deterministic (same value → same JSON)

**Historical test-result claims (unverified):**
- 317 tests passing (122 from Week 8, 195 from earlier weeks)
- RR1-RR12 (risk recovery), LP1-LP9 (ledger), OW1-OW4 (owners), RDB1-RDB8 (recon), RM1-RM4 (router), LC1-LC6 (catch-up), PR1-PR6 (pipeline), RCP1-RCP7 (crashes), RX1-RX7 (export/restore), RCD1-RCD7 (codecs), RJ1-RJ8 (journal), DO1-DO3 (outbox), RSC1 (scheduler), P24-P26 (properties)
- All on real Postgres 18 with deterministic PRNG-seeded scenarios
- Property tests (P24-P26): the archived source configures 100, 40, and 40 runs for the three recovery properties; this is source configuration, not an archived execution log.
- Mutation framework: 18 mutations defined, runner ready
- Chaos script: configured for 5 seeds and 5 SIGKILL points each (25 planned scenarios); execution is not evidenced by a retained run log.

**Known Limits (Documented):**
- ⚠️ **Dedupe sets unbounded:** decidedOrders, seenRequestIds, seenAdjustmentIds, appliedTradeIds, haltedSymbols grow without bound. Eviction deferred to Week 10. Mitigation: periodic restart.
- ⚠️ **No write fencing:** writer_epoch recorded but not enforced. Multi-instance failover requires fencing (Week 10).
- ⚠️ **Recovery time grows:** Tail length unbounded (no compaction). Snapshots mitigate (count-based scheduler RSC1). Full replay time grows O(tail_length).
- ⚠️ **Single partition:** Multi-partition orchestration (Week 9). Single partition proven recoverable independently.
- ⚠️ **Ledger catch-up sequential:** Scans full entry history per run. Idempotency absorbs repeats; performance acceptable for single partition.
- ⚠️ **No API yet:** Claims like "durably received" deferred to Week 9. Recovery is now durable; API will expose it honestly.
- ⚠️ **No fencing enforcement:** Prevents multi-instance concurrent writes. Week 10 adds enforcement (distributed coordination).

**Architecture:**
See [docs/WEEK-8.md](docs/WEEK-8.md) for crash windows, recoverPipeline sequence, state schema, and edge cases.
See [docs/decisions.md](docs/decisions.md) for rationale on atomicity, redelivery, dedupe survival, ledger durability, and scope.
