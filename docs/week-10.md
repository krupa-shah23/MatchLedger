Week 10: Kafka Transport, Fencing and Sharding Experiments
One-week working document. Put it in docs/WEEK-10.md. It covers blueprint "Week 10: Kafka, sharding and scaling experiments". Prompts for Claude Code are in WEEK-10-PROMPTS.md. Week 11 (React UI tier 1, observability) and Week 12 (load tests, deployment, docs) are previewed at the end.
Scope call (read once). Your Week 9 doc previews the React UI as "Week 10". The blueprint's Week 10 is Kafka, fencing and sharding. You need everything running by the end of Week 12, so this document is the Kafka week (the hardest, most likely to slip), and the UI moves to Week 11. File, class and table names below are proposals: check them against the repo and docs/RUNTIME-API.md, and never invent a facade method.
The theme of this week. Until now the system is one process: the risk stage, the shard runners, the router and the API talk through memory, and Postgres journals make it durable. This week the shard runners move into their own processes behind Kafka, and the single-writer rule stops being a convention and becomes something the database enforces. Four claims have to become visible and testable:
The journal is still the truth. Kafka carries live flow. Anything Kafka loses or duplicates can be rebuilt or ignored because of the journal.
A zombie cannot write. A frozen or stalled process that wakes up after its partition moved gets its next write rejected and exits.
Effectively once. Crash at any point between "message consumed" and "events published" and the final state equals an uninterrupted run, with no event applied twice.
Scaling claims are honest. Hypothesis before the run; results say what they prove and what they do not.
Rule for this week: you hand-write FencedPgJournal.append() and the ownership lifecycle (onAssign / onRevoke / onLost). AI tools may help with everything else (section 9).
Budget: about 18 to 24 hours of agent-assisted work plus your two hand-written pieces and review. If you are behind, the cut order is fixed in section 5 (Phase B first, then the E2 run). No buffer week exists before Week 12.

0. Status and carry-over
#
Check
Done when
V1
Week 9 is proven, not reported: RBM, E2E2, OC1, P27, P28 green; check:no-placeholders green
Gate green: npm ci, build, lint, check:boundaries, npm test, npm run test:integration, npm run test:flake 20/20
V2
Spike 4 (owed since Week 1) done against the single-broker compose: T10 to T14
docs/spike-4.md records the real @confluentinc/kafka-javascript names: rebalance callback for revoke and lost partitions, the transaction and offset-commit calls, pause/resume calls, the error thrown when a second producer with the same transactional.id fences the first
V3
Compose runs Kafka 4.2.x KRaft single broker with transaction.state.log.replication.factor=1 and transaction.state.log.min.isr=1, auto topic creation off
docker compose up healthy, a transaction commits
V4
Re-read docs/RUNTIME-API.md. List the facade methods that change in Kafka mode (submit, cancel, halt, resume) and the ones that stay
List in PROGRESS.md
V5
Open Week 8/9 limits: dedupe sets unbounded, no fencing, single process
Written down; this week closes the first two
V6
Week 9 debts: any failing test or skipped test is fixed first
None left

If V2 is not done, do it first. Every Kafka decision below depends on the real API names.

1. Goal and scope
Goal: the pipeline runs across processes over Kafka with database-enforced single-writer ownership, survives crashes, freezes and rebalances, and has a measured, honestly-described scaling story.
In scope this week
Deferred
Topics orders.accepted, engine.events, control.commands; explicit partitionOf routing
More than one active risk/control-plane process (a standby taking over is a stretch)
Shard host process: consume, ShardRunner, DurableEventSink, KafkaEventSink
account.events (router and risk stay in one process; the notice path is already in-process and journaled)
Ownership lifecycle: acquire, recover, run, revoke, lost, fail-stop
Prometheus, Grafana, prom-client (Week 11)
Fencing: shard_leases, fenced journal append (commands and events), transactional producer
Profiling and optimization, E3 (Week 12)
Offsets stored in Postgres in the same transaction as the command batch
Projector on Kafka (it keeps reading the journals)
Republish from published_through; consumer dedupe by (symbol, seq)
Schema registry, Kubernetes, KafkaJS
Control-plane consumer of engine.events feeding router, ledger, MarketView
A cloud E2 run (optional if time)
Cancel, halt, resume over Kafka; control-plane redelivery over Kafka


Dedupe-set bounds (snapshot plus sequence window)


`TRANSPORT=inproc
kafka` flag; parity between modes
E1, E2, hot-symbol, consumer-lag and event-loop-stall scenarios


Phase B: gateway ingress orders.submitted, fenced risk journal, R9, R10



Why account.events is deferred: blueprint 5.4 lists it for the case where the router and the risk workers are separate processes. In this topology they share a process, so a topic there would add a hop and a failure mode for nothing. Record this as a decision; add the topic when the risk stage scales out.

2. Deliverables and definition of done
[ ] V1 to V6 handled; docs/spike-4.md written
[ ] Dependencies and workspaces: new transport package, boundary map, checker and lint updated with proofs (section 4.12)
[ ] Migrations 012 to 015 (Phase B: 016) and tests
[ ] journal: LeaseStore, FencedPgJournal (hand-written append), offset and published_through access; FN, LS tests
[ ] transport: topic config, codecs, transactional producer wrapper, consumer wrapper, dead-letter; TR tests
[ ] shard: ShardHost (ownership lifecycle, hand-written), KafkaEventSink, main.ts entry; OW, KC, RD tests
[ ] runtime: control-plane consumer, TRANSPORT flag, recoverControlPlane; CP, SP, P31 tests
[ ] Dedupe bounds; DW tests
[ ] Chaos suite R5, R7, R8, R11, R12, R13; Phase B: R9, R10
[ ] Compose with K shard services, restart policy, topic script, chaos scripts
[ ] E1 passes; E2 hypothesis written first; docs/SCALING.md complete
[ ] All tests in section 8 exist with their IDs in the titles and pass; test-ID table in PROGRESS.md; flake gate 20/20 for unit and integration
[ ] Mutation table (section 8.11), decisions, README limitations, PROGRESS.md updated
[ ] You can draw the shard write path with its crash windows and the ownership lifecycle from memory
Definition of done: with TRANSPORT=kafka, a client trades through the API; orders flow to two or more shard processes; freezing one shard past the timeout and waking it produces a rejected write and a clean exit, with no gap or duplicate in the journal; killing a shard at any of the crash windows restores state equal to an uninterrupted run; TRANSPORT=inproc still passes the whole Week 9 suite; and docs/SCALING.md says what each experiment proves and does not prove.

3. Technologies and tech stack (this week only)
No new third-party package is needed. Everything is already pinned in Week 1. Use exact versions from docs/versions.md; run npm view <pkg> version peerDependencies before touching any pin.
Area
Choice
Used for
Check
Runtime
Node 24 LTS, TypeScript 6.0.x, npm workspaces
Unchanged
Do not move to Node 26 (Kafka client binaries)
Kafka client
@confluentinc/kafka-javascript 1.10.x
Consumers, transactional producer, rebalance callback
Use names from docs/spike-4.md, not memory; librdkafka properties at top level, KafkaJS-style options in the kafkaJS block
Broker
Apache Kafka 4.2.x, KRaft, single broker
Topics in 4.4
Transaction log settings from V3
Journal
PostgreSQL 18, pg, explicit SQL, SqlExecutor
Leases, fenced append, offsets, published_through
Pool-scoped int8 to bigint parsing already in place
Tests
Vitest 4, fast-check 4, Testcontainers (Postgres, Kafka)
FN, LS, TR, OW, KC, RD, DW, CP, SP, P31, R series
Separate integration project
Chaos
SIGSTOP / SIGCONT on child processes (CI and local), docker pause / unpause (compose), SIGTERM, a test-only loop-blocking hook
R7, R11, R12
Hook only under the demo/test profile
CPU limits
Docker cpus limit per shard container; broker, Postgres and generator pinned elsewhere
E2
Record the host in SCALING.md
Event-loop delay
perf_hooks.monitorEventLoopDelay, logged
E2, R11
prom-client replaces it in Week 11

Starting client settings (confirm every name against Spike 4): enable.auto.commit=false; isolation.level=read_committed; producer acks=all with idempotence on; assignment cooperative-sticky; group.protocol=classic; group.instance.id=<SHARD_ID>; transactional.id=shard-<partition>. For tests use a short session.timeout.ms (keep above the broker minimum) and a short max.poll.interval.ms; production-like values for E2.
Not used: KafkaJS, Kafka Streams, a schema registry, Redis, an ORM, Kubernetes.
Where impure APIs may appear: transport (Kafka client), shard (main.ts, host, sink), runtime, journal (pg through SqlExecutor). engine-core, risk/src/core, the ledger core and common stay pure.

4. Architecture
4.1 Where the code goes
packages/journal/
  migrations/012_shard_leases.sql, 013_consumer_offsets.sql, 014_published_through.sql, 015_dedupe_window.sql (016_ingress.sql, Phase B)
  src/lease-store.ts            // LeaseStore: acquire, current, release
  src/fenced-pg-journal.ts      // FencedPgJournal implements JournalAppender (+ events, offsets)   [hand-write append]
  src/offsets.ts                // OffsetStore: read next_offset, offset-only fenced upsert
  src/published-through.ts      // read and upsert watermarks
packages/transport/              // NEW workspace (decision); depends on common, journal, Kafka client
  src/topics.ts                 // topic names, partition counts, topicFor(), partitionOf wrapper
  src/envelope.ts               // Envelope { schemaVersion, msgId, type, payload }, codec wrappers (bigint as strings)
  src/producer.ts               // TransactionalProducer wrapper (init, send batch, commit, abort, fenced detection)
  src/consumer.ts               // PartitionConsumer wrapper (assign, seek, pause, resume, callbacks)
  src/dead-letter.ts            // publish undecodable messages
  src/startup-checks.ts         // topic exists, partition counts match config
packages/shard/src/
  shard-host.ts                 // ShardHost: ownership lifecycle per partition                     [hand-write lifecycle]
  kafka-event-sink.ts           // KafkaEventSink implements EventSink (transactional publish)
  offset-tickets.ts             // FIFO of consumed offsets aligned with enqueued commands
  republish.ts                  // republish events with seq > published_through
  main.ts                       // process entry, signals, fail-stop
packages/runtime/src/
  control-plane.ts              // engine.events consumer -> router, ledger, MarketView
  recover-control-plane.ts      // recoverPipeline steps 2 to 6; step 1 becomes read-only engine journal access
  transport-flag.ts             // TRANSPORT=inproc|kafka composition
packages/risk/src/              // dedupe-window bounds in RiskCore state (core change limited to bounds, see 4.10)
packages/system-tests/test/kafka-*.int.test.ts, chaos-*.int.test.ts, harness/   // process spawner, freeze/kill helpers
scripts/create-topics.mjs, chaos-freeze.sh, e1-sharding.mjs, e2-scaling.mjs
docs/spike-4.md, docs/SCALING.md

4.2 Topology and what talks to what
flowchart LR
  C[Client] -->|HTTP + JWT| CP
  subgraph CP[Control-plane process]
    API[API, projector, WS hub]
    RS[RiskStage partitions<br/>journal risk-p]
    RTR[Router, Ledger, MarketView,<br/>LeakSweeper]
    API -->|runtime facade| RS
    RTR -->|account commands, in-process notice path| RS
  end
  RS -->|"orders.accepted (key symbol)"| KA{{Kafka}}
  API -->|"control.commands (key symbol)"| KA
  KA --> S1[Shard process 1<br/>owns partitions 0,1]
  KA --> S2[Shard process 2<br/>owns partitions 2,3]
  S1 -->|"engine.events (key symbol), txn"| KB{{Kafka}}
  S2 --> KB
  KB --> RTR
  S1 --> PG[(Postgres:<br/>journal, shard_leases,<br/>consumer_offsets, published_through)]
  S2 --> PG
  RS --> PG
  PG --> API

Rules baked into the picture:
The shard never trusts Kafka for position. Its consume position is the next_offset stored in Postgres in the same transaction as the journaled commands.
Journal before apply, apply before publish, exactly as in Weeks 4 and 5. Kafka sits after DurableEventSink: DurableEventSink(downstream = KafkaEventSink).
One owner per partition, proven by epoch, not by Kafka. Every journal write (commands and events) carries the lease epoch and is conditional on it.
Fail-stop. Any fencing failure, fenced producer, unhandled rejection or uncaught exception exits the process. The supervisor (compose restart: unless-stopped) restarts it through the normal path.
The control plane reads the same journals recovery reads. The projector is untouched. The engine journal is read-only for the control plane.
Time stays an input. Ticks are generated by the owning shard's TickInjector, stamped and journaled like any command. A shard injects no ticks while recovering and none for symbols it does not own.
Deadlock rule survives. Caller commands stay bounded, engine notices stay unbounded and non-blocking. The Kafka consumer pauses a partition when tryEnqueue returns FULL; it never drops and never buffers without bound.
4.3 Schema (migrations 012 to 015; adapt column names to your Week 5 codec, keep the semantics)
-- 012_shard_leases.sql
CREATE TABLE shard_leases (
  lease_id text PRIMARY KEY,                      -- 'shard-<partition>' ; risk streams use 'risk-<partition>' (same as stream_id)
  owner text NOT NULL,                            -- instance id, informational
  epoch bigint NOT NULL CHECK (epoch >= 1),
  acquired_at timestamptz NOT NULL DEFAULT now());


-- 013_consumer_offsets.sql  (authoritative consume position)
CREATE TABLE consumer_offsets (
  lease_id text NOT NULL, topic text NOT NULL, partition integer NOT NULL,
  next_offset bigint NOT NULL CHECK (next_offset >= 0),
  writer_epoch bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lease_id, topic, partition));


-- 014_published_through.sql  (lagging watermark: what was published to engine.events, safe to be behind)
CREATE TABLE published_through (
  lease_id text NOT NULL, symbol text NOT NULL, seq bigint NOT NULL CHECK (seq >= 0),
  PRIMARY KEY (lease_id, symbol));


-- 015_dedupe_window.sql
-- Only if the bounded risk state needs a place to record the window floor per partition (see 4.10).
-- Otherwise this migration is empty and is skipped. Decide on Day 5 and record it.


-- 016_ingress.sql (Phase B)
ALTER TABLE order_requests ADD COLUMN published_at timestamptz;   -- set after the Kafka ack for orders.submitted

The journal table is unchanged: writer_epoch has been recorded since Week 5 and is now enforced.
4.4 Topics and message contracts
Topic
Key
Partitions
Producer
Consumer
Content
orders.accepted
symbol
4
risk stage (outbox): placed orders, forwarded cancels, sweeper cancels
shard hosts
Existing OrderAccepted fields (reservation id, priceCap, effective price) translated by acceptedToPlaceOrder; or CancelOrder. Header redelivered=true when sent by control-plane recovery
engine.events
symbol
4
shard hosts (transactional)
control plane
One ShardOutput per message: { symbol, seq, ts, command, events }
control.commands
symbol
4
API (halt, resume)
shard hosts
HaltSymbol, ResumeSymbol with actor and reason
orders.submitted (B)
accountId
N = risk partition count
gateway (idempotent producer, acks=all)
risk stage
SubmitOrder with orderId
dlq.<topic>
n/a
1
any consumer
operator
Undecodable raw bytes plus error and source coordinates

Partition counts are fixed for the project. partitionOf(key, count) (FNV-1a, common) chooses the partition; producers pass the partition explicitly. The consumer-side check in startup-checks.ts asserts that topic metadata equals config, or the process refuses to start.
Envelope: { schemaVersion, msgId, type, payload }, JSON, bigint as decimal strings through the shared money codec, versioned like the journal codecs. msgId is deterministic where a natural identity exists (symbol:seq for engine events) so duplicates are recognizable.
4.5 The fenced append (you hand-write FencedPgJournal.append)
One transaction, one round trip. Sketch (adapt names):
WITH lease AS (
  SELECT epoch FROM shard_leases WHERE lease_id = $1 FOR SHARE          -- blocks a concurrent acquire until we commit
), ins AS (
  INSERT INTO journal (stream_id, seq, record_type, idx, schema_version, ts, writer_epoch, payload_json)
  SELECT u.stream_id, u.seq, 'COMMAND', 0, u.sv, u.ts, 2,u.payloadFROMunnest(3::text[], $4::bigint[], $5::smallint[], $6::bigint[], $7::jsonb[]) AS u(stream_id, seq, sv, ts, payload)
  WHERE (SELECT epoch FROM lease) = $2                                  -- conditional on OUR epoch
  RETURNING 1
), off AS (
  INSERT INTO consumer_offsets (lease_id, topic, partition, next_offset, writer_epoch)
  SELECT $1, $8, $9, $10, $2 WHERE (SELECT epoch FROM lease) = $2 AND $10 IS NOT NULL
  ON CONFLICT (lease_id, topic, partition)
  DO UPDATE SET next_offset = GREATEST(consumer_offsets.next_offset, EXCLUDED.next_offset),
                writer_epoch = EXCLUDED.writer_epoch, updated_at = now()
  RETURNING 1
)
SELECT (SELECT count(*) FROM ins) AS inserted, (SELECT epoch FROM lease) AS current_epoch;

Contract:
inserted === batch.length, otherwise throw. If current_epoch !== myEpoch (or the lease row is missing) throw FencedWriterError; any other mismatch is a bug (JournalGapError), never swallowed.
No ON CONFLICT on the command insert: a primary-key conflict means two writers or a bug, and must surface as an error, as in Week 5.
Why FOR SHARE: the new owner's UPDATE ... SET epoch = epoch + 1 needs an exclusive row lock, so it waits for any in-flight append to commit. Everything a zombie committed is therefore visible to the new owner's recovery read, and every append that starts after the acquire commits sees the new epoch and fails.
The same condition guards appendEvents (EVENT rows from DurableEventSink), the offset-only upsert, and the published_through upsert. A fenced writer must not be able to write anything.
Everything stays bigint through the codec; no Number for seq beyond the existing safe-integer check.
LeaseStore.acquire(leaseId, owner): insert the row at epoch 0 if missing, then one atomic UPDATE ... SET epoch = epoch + 1, owner = $2, acquired_at = now() ... RETURNING epoch. Epochs are strictly increasing, gaps are fine, no TTL (fencing is by epoch, not by time).
4.6 Ownership lifecycle (you hand-write onAssign / onRevoke / onLost)
flowchart TD
  A[assigned partition p] --> L["1. epoch = leases.acquire('shard-p')"]
  L --> P["2. init transactional producer 'shard-p' (fences any older producer)"]
  P --> R["3. recover: snapshot + tail replay for each symbol of p<br/>(existing recoverStream, reads through the new journal)"]
  R --> RP["4. republish: events with seq > published_through, one transaction"]
  RP --> RUN["5. build ShardRunner(symbols of p, FencedPgJournal, DurableEventSink(KafkaEventSink)), start, start TickInjector"]
  RUN --> S["6. read next_offset from consumer_offsets, seek, resume consuming"]
  S --> W[running]
  W -->|revoked| RV["stop consuming; runner.stop(drain:false); await done;<br/>discard unjournaled queue; disconnect producer; release"]
  W -->|lost| LO["treat as fenced: stop, no commit attempts, expect FencedWriterError, exit"]
  W -->|FencedWriterError, fenced producer, uncaught| FS[log, exit non-zero]

Rules:
Lease before recovery. Otherwise a zombie can write between your read and your first write.
Producer init before processing. It fences any older producer with the same transactional.id.
No enqueue after revoke. A message callback arriving after the partition was revoked is dropped without a trace in state. The queue's unjournaled content is discarded; those commands are redelivered from the stored offset to whoever owns the partition next.
Per-partition runner. One ShardRunner per owned partition holds that partition's symbols. ShardRunner.run() is unchanged.
Offset tickets. When tryEnqueue returns ACCEPTED, the host pushes {topic, partition, offset} into OffsetTickets (FIFO). FencedPgJournal.append(batch) pops one ticket per non-Tick command in the batch (same order as dequeue) and upserts max(offset) + 1 in the same statement. If counts do not match, throw (a bug, not a recoverable state). FULL, UNKNOWN_SYMBOL and CLOSED push nothing.
Poison messages. Undecodable: publish to dlq.<topic>, then advance the stored offset with an offset-only fenced upsert, so the partition is never blocked. Decoded but invalid: let the engine reject it as today.
Backpressure. On FULL, pause the partition (client call from Spike 4), resume when the queue drains. The pause loop must not busy-spin.
SIGTERM. Stop consuming; stop runners with drain; finish or abort the open transaction; flush journal; release leases; exit. A second SIGTERM forces exit.
4.7 The shard write path and its crash windows (the table to memorize)
consume -> tryEnqueue(ACCEPTED) -> ticket
runner: stamp -> FencedPgJournal.append(commands + offset)   [durable]
        -> engine.apply (sync)
        -> DurableEventSink: appendEvents (fenced)            [durable]
        -> KafkaEventSink: txn{ send engine.events } commit
        -> upsert published_through (lagging, fenced)
        -> afterBatch: snapshot scheduler (between batches)

#
Crash point
Durable state
Recovery does
Visible effect
KC1
After the Kafka message was consumed, before tryEnqueue
Nothing new
Seeks to stored offset; the message is read again
None
KC2
After enqueue, before the journal commit
Nothing new
Same
None
KC3
After the journal commit (commands and offset), before apply
Commands and offset
Replay regenerates events (existing recovery), republish
Delay only
KC4
During apply
Same as KC3
Same
None
KC5
After EVENT rows are journaled, before the Kafka transaction
Commands, events, offset
Republish events above published_through
Delay only
KC6
During the Kafka transaction (before commit)
Same as KC5; transaction aborts
Same
Aborted records are invisible to read_committed consumers
KC7
After Kafka commit, before the published_through upsert
Same plus published events
Republish the same events again
Duplicates on the topic; consumers dedupe by (symbol, seq)
KC8
During lease acquire
Maybe a higher epoch with no owner
Next acquire increments again
None
KC9
During a snapshot write
No or torn snapshot
Previous valid snapshot, else full replay
Slower recovery

The control plane has its own windows: Week 8 RCP1 to RCP7 still apply. RCP3 and RCP4 change meaning in Kafka mode (4.8).
4.8 The control plane in Kafka mode
Consumer of engine.events: one consumer group, all partitions. For each ShardOutput, skip it if seq <= router watermark for that symbol (Week 8 router watermark), else call EngineEventRouter.onShardOutputs. Kafka offsets are committed after the router returned (at-least-once; the watermark and the core's appliedTradeIds make duplicates harmless; ledger posts are idempotent by txId).
Notice path: unchanged and in-process (unbounded, journaled by the risk partition). This is why account.events is deferred.
Cancels: a client cancel and the leak sweeper's cancel both travel on orders.accepted, keyed by symbol, the same ordered channel the original order used. The sweeper's argument for safety (a cancel cannot overtake its order) holds because a topic partition is ordered.
Halt and resume: API publishes HaltSymbol / ResumeSymbol to control.commands (key symbol). Ordering relative to orders is not required. The shard enqueues them to the runner like any command, so they are stamped and journaled.
Redelivery (RCP3 and RCP4 in Kafka mode): step 5 of recoverPipeline ("PENDING_ACK orders with no PlaceOrder in the engine journal") now republishes OrderAccepted to orders.accepted with header redelivered=true. Danger: the original message may still be unconsumed in the topic, so the shard can see two PlaceOrders for one order. The engine only rejects a duplicate order id that is currently resting; a duplicate after a fill would trade again. Rule: for messages with redelivered=true, the shard host first checks the engine journal for an existing PlaceOrder for that orderId (the journal_cmd_order index from migration 007) and skips it (advancing the offset) if present.
recoverControlPlane: steps 2 to 6 of recoverPipeline. Step 1 (recoverShard) no longer runs here; the engine journal is read-only. MarketView rebuilds by replaying the engine EVENT rows through MarketView.apply per symbol (simple first; if the recovery-time table says it is slow, add a bounded tail replay as a later change). Fatal errors stay fatal.
4.9 Phase B: ingress over Kafka (orders.submitted)
submitOrderDurably() keeps its contract ("202 means durably received") but its durability point changes in kafka mode:
Single-flight, then register(accountId, clientOrderId, payloadHash, orderId) in order_requests as today (409 on payload mismatch).
Publish SubmitOrder to orders.submitted, key accountId, explicit partition partitionOf(accountId, N), idempotent producer, acks=all. On publish failure: 503 with Retry-After, never 202.
After the ack, set order_requests.published_at, then return 202 {orderId, status: RECEIVED}.
A retry that finds the row with published_at null republishes (the risk core's orderId dedupe makes it safe).
GET /orders/{id} is visible (synthesized RECEIVED) once published_at is set, even before the risk journal has the command. A row with published_at null is invisible (404), as an unjournaled order is today.
The risk consumer calls the same bounded submit entry the facade used; the risk partition journals SubmitOrder through a fenced journal with lease_id = risk-<p> and stores the offset in the same transaction.
You hand-write the changes to submitOrderDurably(); the in-process branch must stay byte-for-byte equivalent in behavior (OA tests unchanged).
4.10 Bounding the dedupe sets
decidedOrders and seenRequestIds (and seenAdjustmentIds) in RiskState grow without bound today. Policy:
Keep every id of an order that is still live (has a reservation) forever, plus ids decided within the last DEDUPE_WINDOW_SEQ risk-journal sequence numbers of that partition. Older decided ids are evicted when a snapshot is written; the snapshot records the window floor.
Why this is safe: after this week, Kafka redelivery into the journal cannot happen (the stored offset moves atomically with the commands). A resubmission of an old id is blocked earlier: the gateway's order_requests unique key plus its hasSubmitCommand(orderId) check against the risk journal index (durable, unbounded). The core's set is a safety net for the recent past, not the primary dedupe.
Default DEDUPE_WINDOW_SEQ is large (hundreds of thousands) and must exceed the longest span in which a duplicate could still be in flight. Evicting an id that is still redeliverable would permit a double spend; DW tests assert both directions.
RiskState version bumps with an upcaster for old snapshots. This is the only change allowed in risk/src/core: state bounds, nothing else.
4.11 Config (zod-parsed env, fail fast with a readable list)
TRANSPORT (inproc | kafka), KAFKA_BROKERS, SHARD_ID (unique per container, also group.instance.id), SHARD_PARTITIONS (4), RISK_PARTITIONS, SESSION_TIMEOUT_MS, MAX_POLL_INTERVAL_MS, TXN_TIMEOUT_MS, QUEUE_CAPACITY, MAX_BATCH, DEDUPE_WINDOW_SEQ, SNAPSHOT_EVERY, SHUTDOWN_GRACE_MS, PROFILE (demo | prod; chaos hooks only in demo/test).
4.12 Dependency map and lint
Package
May depend on
Must not
transport (new, decision)
common, journal, the Kafka client
api, web, risk cores, engine-core runtime imports
shard
engine-core, common, journal, transport
api, web
journal
engine-core, common, pg
Kafka, web
runtime
all backend packages including transport
web
api
unchanged; Kafka is reached only through runtime ports
Kafka client directly
risk
common, journal
Kafka client directly (the host adapter lives in runtime)

Update scripts/check-boundaries.mjs and docs/BLUEPRINT.md 4.4 in the same commit, and prove the checker fails on a seeded violation. engine-core, ShardRunner.run() and the ledger core are unchanged: git diff on them is empty.

5. How to build it (day by day) and cut lines
Write the failing test first each day. Phase A is days 1 to 5, Phase B is days 6 to 7.
Day
Hours
Do
Done when
0/1
3 to 4
V1 to V6, Spike 4, compose, create-topics, transport skeleton, boundary updates
Spike notes written; topics exist; Week 9 suite green
2
3 to 4
Migrations 012 to 014, LeaseStore, you hand-write FencedPgJournal.append, events and offsets fenced
FN1 to FN8, LS1 to LS3 green (Postgres only, no Kafka)
split point 1




Fencing proven without Kafka
3
3 to 4
transport codecs/producer/consumer, KafkaEventSink, ShardHost consumption, offset tickets, republish, backpressure
TR1 to TR8, KC1 to KC9 (as far as testable), R5, R12
4
3 to 4
You hand-write the ownership lifecycle; zombie tests; fail-stop wiring; compose restart
OW1 to OW5, R7, R8, R11
split point 2




Single-writer proven end to end
5
3 to 4
Control-plane consumer, recoverControlPlane, cancel/halt/resume over Kafka, redelivery rule, dedupe bounds, TRANSPORT flag, parity
CP1 to CP5, RD1, RD2, DW1 to DW3, SP1, P31 green; E1 passes
6
3
Phase B: orders.submitted, published_at, fenced risk journal and offsets
IN1 to IN6, R9, R10
7
3
E2 hypothesis, harness and run, HS1, CL1, R13, SCALING.md, mutations, decisions
Write-up done; everything green; CI green

Cut lines, in this order, decided now: (1) Phase B moves to the start of Week 11, (2) the E2 run moves to Week 11 with Grafana, (3) the lag scenario CL1 shrinks to a manual note. Never cut: FN, R7, R11, KC, SP1. TRANSPORT=inproc stays deployable.
Stuck protocol: if a Kafka behavior surprises you for more than 90 minutes, reduce it to one partition, one shard process, one symbol and three commands, and compare with the inproc run field by field. The first differing event names the broken window (usually KC5 to KC7, an offset ticket mismatch, or a missed republish).

6. Worked scenarios (use as fixtures)
To pick symbols, write a helper symbolsForPartitions(spec) that searches synthetic names until partitionOf(symbol, 4) lands where you want. Do not hard-code which partition a name hashes to.
Scenario 1: happy path across two shards (SP1, P31). Shard A owns partitions 0 and 1, shard B owns 2 and 3. Symbols AAA and BBB hash to partitions owned by different shards. Alice buys on AAA, Bob sells on BBB, Carol crosses on each. Each trade appears once on engine.events, balances and positions equal the inproc run field by field, and journal seq is contiguous per symbol.
Scenario 2: the zombie (R7). A owns shard-0 at epoch 1 and has journaled up to seq 120 on AAA. SIGSTOP A past the session timeout. The group moves partition 0 to B. B acquires shard-0 (epoch 2), recovers (sees seq 120), seeks to the stored offset, processes 20 more commands (seq 121 to 140). SIGCONT A. A's callback fires with a buffered command; its append runs with epoch 1, inserts 0 rows, throws FencedWriterError, and A exits non-zero. Journal check: seq 1 to 140, no gap, no duplicate, no row with writer_epoch = 1 above seq 120. A restarts, is assigned nothing or something else, and acquires a fresh epoch if it owns a partition again.
Scenario 3: crash between journal commit and Kafka commit (KC5/KC7, TR8). Seq 41 to 44 are journaled with events; published_through is 40. Kill the shard before the transaction commits. Restart: lease epoch increments, recovery restores state through seq 44, republish sends events for seq 41 to 44 in one transaction, published_through becomes 44. A deduping consumer sees seq 41 to 44 exactly once. A raw consumer may see duplicates in the KC7 variant.
Scenario 4: event-loop stall (R11). A busy loop longer than the setting that actually fires (max.poll.interval.ms, verified in Spike 4) blocks the shard. The consumer leaves the group, the partition moves to B (epoch 2). When the loop ends, A's runner tries to append: fenced, exit. Same journal assertions as Scenario 2.
Scenario 5: duplicate PlaceOrder via redelivery (RD1). Control-plane recovery republishes OrderAccepted for order O with redelivered=true while the original message is still unconsumed. The shard consumes the original (journaled, fills fully), then the redelivered copy. The host finds a PlaceOrder for O in the engine journal and skips it, advancing the offset. No second trade, no second reservation convert.
Scenario 6: E1 failover. K = 2 shards, 8 symbols, 2 per partition. Run a seeded flow. Kill shard B mid-flow. Shard A takes partitions 2 and 3 (lease epochs 2 for those), recovers, continues. Restart B; the group rebalances (cooperative); B reacquires. Compare final per-symbol book hashes and snapshot checksums with an uninterrupted run of the same seeded flow: equal.
Scenario 7: hot symbol (HS1). 80% of orders go to one symbol. The shard owning it saturates (event-loop delay and queue depth rise, FULL pauses happen); the other shards stay idle. Total throughput is bounded by one shard. The write-up says a single book cannot be split.
Scenario 8: gateway and Kafka (R9, R10; Phase B). (a) Kill the gateway after the Kafka ack, before the 202: the client retries with the same clientOrderId, register returns DUPLICATE, published_at is set, 202 with the same orderId, exactly one SubmitOrder journaled. (b) Stop the broker: POST returns 503 with Retry-After, published_at stays null, GET returns 404, no order exists.

7. Edge cases to handle
Fencing and ownership
Zombie after SIGSTOP or docker pause: its next write inserts 0 rows, throws FencedWriterError, exits. No stale-epoch row ever exists above the takeover point
Zombie write racing the takeover: FOR SHARE on the lease row orders them; acquire before recovery
Recovery fails after the lease was acquired (ReplayMismatchError, JournalGapError, OwnerMissingError): fatal; start nothing; exit
Producer fenced while Postgres epoch is still valid (partial fence): still fatal
Two containers with the same group.instance.id or the same SHARD_ID: configuration error, refuse to start if detectable
Revoke while a batch is mid-flight: the batch that already passed the journal append finishes if still owner, otherwise it is abandoned; republish covers the rest
Lost partition (not a graceful revoke): never attempt to commit; expect FencedWriterError
A lease holder dies without releasing: nothing to clean; the next acquire increments
A process owns two partitions and one is fenced: the whole process exits (decision 6)
Epoch and seq are bigint in the database; check safe-integer conversion on read, as in Week 5
Delivery
Crash between journal commit and Kafka commit (KC5 to KC7): republish from published_through; consumers dedupe by (symbol, seq)
Aborted transaction never visible to read_committed consumers
Undecodable message: dead-letter, advance the stored offset, count it
Message for a symbol not owned by this partition (misrouted): treat as poison, dead-letter, alert
Cancel arrives for an order already gone: engine answers CancelRejected; harmless and journaled
Duplicate OrderAccepted through control-plane redelivery: the journal lookup rule (4.8)
Order of cancel and order for one symbol: preserved by the single partition
Broker down mid-transaction: bounded retry; if the outcome is unknown, abort and exit; the restart republishes
Topic missing or partition count differs from config: refuse to start
Kafka committed offset behind the stored offset (or ahead, or missing): always seek to the stored offset; the Kafka offset is advisory
First start with no stored offset: start at the beginning of the partition
Node-specific
A blocked event loop: librdkafka's heartbeats run on a native thread, so a JS stall most likely trips max.poll.interval.ms, not session.timeout.ms. Verify in Spike 4 and size R11 against the one that fires. A paused or stopped process (R7) freezes the native threads too, so the session timeout fires
Cap batch size, yield between batches, never run long synchronous work between polls
Unhandled rejection from a client callback: log and exit
JSON.stringify on a bigint throws: all Kafka payloads go through the money codec
Timers in tests: injected scheduler, no sleeps, as in Weeks 4 to 9
State and operations
Snapshot is taken only between batches; after restore the stored offset and the snapshot's last seq agree (offset can be ahead of the snapshot, never behind the journal)
Dedupe eviction is never allowed for a live order's id
Ticks: only for owned symbols, none while recovering, none after revoke
Hot symbol: one partition saturates, others idle; documented, not hidden
Consumer lag grows when a shard is slow: backpressure, no drop, no unbounded buffer; the pause/resume loop must not spin
Rebalance storm: cooperative-sticky and static membership reduce churn; correctness never depends on it
E2 noise: pin CPUs, warm up, fixed seed, three runs, report median and range
TRANSPORT=inproc must never import the Kafka client (lazy import or a separate composition file)
Process-level
Startup order for a shard: config, startup checks, pool, migrations check, join group, per-partition lifecycle; listening sockets are not involved
Startup order for the control plane: config, pool, migrations, recoverControlPlane, projector catch-up, start Kafka consumers, then the API listens
SIGTERM: see 4.6 rule 8
Unhandled rejection or uncaught exception: log, then exit

8. Test cases to pass
All new; add the IDs to the blueprint tables. Every ID below must appear in a real test title. Pure tests run in the unit project; Postgres and Kafka tests in the integration project. Time is injected (no sleeps). Process-level chaos tests spawn child processes from packages/system-tests/test/harness.
8.1 Leases and the fenced journal (Postgres only)
#
Test
Expected
LS1
acquire twice for one lease
Epochs 1 then 2
LS2
Concurrent acquire from many connections
All epochs distinct and increasing
LS3
acquire for a different lease id
Independent counters
FN1
Append with the current epoch
Rows written with that writer_epoch; offset upserted
FN2
Append with a stale epoch
FencedWriterError, zero rows, offset unchanged, nothing partial
FN3
Append for a missing lease
FencedWriterError
FN4
Acquire while an append is held open (gated)
Append commits first or fails whole; after the acquire commits no stale-epoch row can be written
FN5
appendEvents with a stale epoch
FencedWriterError, no EVENT rows
FN6
Offset-only upsert and published_through upsert with a stale epoch
Rejected
FN7
Primary-key conflict (same seq twice, same epoch)
Surfaces as an error, not as fencing
FN8
Same fenced append on a risk-<p> stream
Same behavior
FN9
Offsets: GREATEST keeps the maximum; stored offset never moves backward
Correct

8.2 Transport (Kafka)
#
Test
Expected
TR1
Produce and consume with explicit partition partitionOf(key, 4)
Same key, same partition, order kept
TR2
Transactional batch with events
All visible together to read_committed; aborted batch invisible
TR3
Second producer with the same transactional.id
First is fenced; error name equals the one in docs/spike-4.md
TR4
Envelope round trip with bigint values and a deterministic msgId; undecodable bytes
Exact values; dead-letter, stored offset advances
TR5
Queue FULL
Partition paused, nothing dropped, order kept, resumes when drained
TR6
Startup checks
Wrong partition count or missing topic fails fast with a readable list
TR7
Kafka committed offset behind or ahead of the stored offset
Seek to the stored offset; no double apply, no skip
TR8
Crash between journal commit and Kafka commit (Scenario 3)
Deduping consumer sees each event exactly once
TR9
KafkaEventSink fails after sending, before commit
Transaction aborted; nothing visible; process exits

8.3 Ownership lifecycle
#
Test
Expected
OW1
Assign
Order is: acquire lease, init producer, recover, republish, start runner, seek, consume (call-order spy)
OW2
Revoke
Consumption stopped, runner stopped without drain, no enqueue after, producer disconnected
OW3
Lost partition
No commit attempted; a later FencedWriterError exits
OW4
Two partitions on one process, one fenced
Process exits
OW5
Recovery fatal error after lease acquire
Nothing starts, exit non-zero
OW6
Ticks
None while recovering, none for unowned symbols, none after revoke
OW7
Offset tickets
One ticket per non-Tick command; mismatch throws

8.4 Crash windows (shard write path)
#
Test
Expected
KC1
Kill after consume, before enqueue
Command read again, applied once
KC2
Kill after enqueue, before journal commit
Same
KC3
Kill after journal commit, before apply
Recovery regenerates and republishes; state equals uninterrupted run
KC4
Kill during apply
Same
KC5
Kill after EVENT rows, before the Kafka transaction
Republished from published_through
KC6
Kill inside the Kafka transaction
Aborted records invisible; republished
KC7
Kill after Kafka commit, before published_through
Duplicates on the topic; a deduping consumer applies once
KC8
Kill during lease acquire
Next start acquires a higher epoch
KC9
Kill during a snapshot write
Previous snapshot used
P31
Property: random seeded flows in kafka mode vs inproc mode, with a random kill at a random window
Balances, positions, books, reservations, ledger and journal events are identical

8.5 Control plane and redelivery
#
Test
Expected
CP1
Duplicate engine.events messages
Ignored by the router watermark; balances unchanged
CP2
Control plane restarted mid-flow
Catches up from the engine journal; reservations converge
CP3
Week 6 scenarios P16 to P19 re-run in kafka mode
Same results
CP4
Ledger zero-sum per asset with duplicates delivered
Holds; idempotent by txId
CP5
MarketView after control-plane restart
Equals the live view
CP6
Cancel and sweeper cancel travel on orders.accepted
Never overtake their order
CP7
Halt and resume over control.commands
Shard journals them; breaker state follows (K10 to K12 in Kafka mode)
RD1
Scenario 5 (redelivered duplicate PlaceOrder)
Skipped by journal lookup; one trade
RD2
Redelivery for an order that never reached the shard
Placed exactly once

8.6 Dedupe bounds
#
Test
Expected
DW1
Run past the window
Sets stay bounded; live-order ids never evicted
DW2
Duplicate inside the window
Ignored
DW3
Snapshot with an old-version state
Upcast and restored; checks pass
DW4
Resubmission of an evicted id through the gateway
Blocked by order_requests / hasSubmitCommand; one order

8.7 Chaos (blueprint R series, sharpened)
#
Test
Expected
R5
Restart a consumer mid-batch (rebalance)
No lost or double-applied events; final books and journals equal an uninterrupted run
R7
Freeze a shard past the session timeout, let the other take over, resume the frozen one
Its writes are rejected, it exits; journal seq contiguous, no duplicates, no stale-epoch rows above the takeover point
R8
Repeated rebalances under load
No command applied twice or out of order; C1, P5, P6 still hold
R9 (B)
Kill the gateway after the Kafka ack, before the 202; client retries
Exactly one order; the retry returns the original orderId
R10 (B)
Broker unavailable to the gateway
503 with Retry-After, never 202; GET 404; no order exists
R11
Block the event loop past the setting that fires
Process is fenced on resume, exits, restarts; no gaps or duplicates
R12
SIGTERM under load
Consumption stops, journal flushed, leases released, clean exit; restart has no replay anomalies
R13
Broker restart under load
No loss; bounded retries, or exit and republish
R14 (B)
Zombie control plane (stopped, replaced, resumed)
Its risk-journal writes are fenced; exits

8.8 Phase B ingress
#
Test
Expected
IN1
202 only after the Kafka ack (gated producer)
No 202 before the ack
IN2
Publish failure
503 with Retry-After; published_at null
IN3
Retry with published_at null
Republished; one SubmitOrder journaled
IN4
GET visibility
404 before published_at, synthesized RECEIVED after
IN5
Risk consumer journals through the fenced risk-<p> journal with the offset in the same transaction
Crash windows mirror KC1 to KC4
IN6
OA1 to OA15 and P30 re-run with INGRESS over Kafka
Unchanged results

8.9 System and experiments
#
Test
Expected
SP1
Full Week 9 suite in inproc and kafka modes
Both green
E1
Scenario 6
Equal book hashes and checksums; routing and ordering assertions hold
HS1
Hot symbol
Other shards unaffected; skew visible
CL1
A slow shard builds lag
Backpressure engages; no drop; engine latency of other shards unaffected
NP1
check:no-placeholders
Still green

8.10 Determinism and flake gate
No setTimeout sleeps, no Math.random; chaos tests use gates and explicit process signals, and wait on observable conditions (journal contents, process exit), never on durations. Property tests use fixed seeds that are logged on failure. npm run test:flake covers unit and integration including the new suites: 20 of 20. Unique Postgres schema and unique topic names per test file.
8.11 Regression and mutation checks
Every earlier test passes unmodified: C1, C1b, C2, K10 to K12, R1 to R4, P7, P8, P15x, P19x, P24 to P30, RCP1 to RCP7, all Week 9 IDs.
Run with the Week 8 runner scripts/mutate.mjs (temp copy, never git), adding to tools/mutations-week10.json. A survivor means a test gap (add a test, not a production change):
Epoch compared in a separate statement from the insert: FN4.
FOR SHARE dropped: FN4.
Lease acquired after recovery instead of before: OW1, R7.
Events appended without the epoch condition: FN5.
published_through upsert not fenced: FN6.
Offset stored in a separate transaction from the commands: KC3, TR7.
Offset moves backward on redelivery (no GREATEST): FN9.
Consume position taken from the Kafka committed offset: TR7.
Republish skipped after recovery: KC5, TR8.
Consumers do not dedupe by (symbol, seq): KC7, CP1.
Enqueue allowed after revoke: OW2.
Fencing failure logged but process keeps running: R7, R11.
Producer transactional.id not stable per partition: TR3.
Cancel published to a different partition than its order: CP6.
redelivered=true lookup removed: RD1.
Undecodable message blocks the partition: TR4.
Dedupe eviction drops a live order's id: DW1.
Ticks injected for unowned symbols: OW6.
Gateway returns 202 before the Kafka ack: IN1.
published_at set before the ack: IN2, R10.
Kafka mode silently diverges from inproc: P31.
Tests contain it.todo/skip: NP1.

9. Rules for this week
engine-core, ShardRunner.run(), the ledger core and risk/src/core (except the dedupe bounds in 4.10) are unchanged. git diff on them must be empty or limited to that.
The API never imports the Kafka client. It reaches Kafka only through runtime ports.
Postgres is the truth. Kafka offsets are advisory; never seek from them.
Every write by a shard or risk partition carries the epoch. No write path bypasses FencedPgJournal.
A fencing failure exits the process. No retry, no catch-and-continue.
No placeholders: no it.todo, it.skip, xit, TODO, "placeholder", "NOT IMPLEMENTED", constant-returning fakes or invented test names. If something cannot be finished, stop and report.
Test IDs are exact; never weaken or edit an existing test to make it pass.
Money and quantities cross Kafka only as decimal strings through the shared codec.
Never swallow a replay, gap, owner or invariant error.
Chaos hooks exist only under PROFILE=demo or the test harness.
Every number in the docs comes from a run you can point to; write the E2 hypothesis before running E2.
Your own git identity commits everything; the agent never runs git write commands.
AI tools this week. Allowed: everything except two pieces. Not allowed: FencedPgJournal.append() and the ownership lifecycle (onAssign, onRevoke, onLost). You defend those line by line.

10. Experiments
E1: sharding correctness (laptop). Scenario 6. Checks: every symbol is processed only by its owner; per-symbol seq is contiguous and ordered; failover moves partitions and replay restores equal state; failback works. Proves routing, ordering, failover plus replay. Does not prove anything about throughput.
E2: contention-aware scaling. Write the hypothesis first in SCALING.md, for example: "throughput grows roughly linearly with shard count until Kafka or Postgres saturates". Setup: K = 1, 2, 4 shard containers with a CPU limit of one core each, broker, Postgres and generator pinned to separate cores, fixed seed, symbols spread two per partition, then the hot-symbol variant. Per run record: orders per second at the engine, p50/p95/p99 submit-to-event latency, shard CPU, event-loop delay, consumer lag, Postgres commit time. Three repetitions, warm-up discarded, report median and range. Then record the result and explain every deviation. A flat curve on one laptop is a shared-resource artifact, not a failed design; the README says so. Proves behavior under stated limits and where the bottleneck moves (shard CPU, then Kafka, then Postgres). Does not prove production scale.
E3 (single-process optimization) is Week 12.
docs/SCALING.md contains: environment, hypothesis, results table, deviations explained, and an explicit "proves / does not prove" for E1 and E2.

11. Decisions to record in docs/decisions.md
Format: context, options, choice, trade-offs, how tested.
Journal is truth, Kafka is transport (why not Kafka as the journal).
Offsets in Postgres in the same transaction as the command batch; Kafka offsets advisory; offset tickets.
Republish from published_through plus consumer dedupe by (symbol, seq); at-least-once on the topic, effectively-once in state.
Lease ids (shard-<p>, risk-<p>), epoch check with FOR SHARE, no TTL.
Lease before recovery; producer init before processing.
Any fencing failure exits the whole process.
Explicit partitionOf, fixed partition counts, startup assertion.
Cancels on orders.accepted; halt/resume on control.commands.
account.events deferred and why.
Redelivery flag and the engine-journal lookup (the engine remembers no filled ids).
Dedupe window policy and why eviction is safe.
New transport workspace and the dependency-map change.
Projector stays on the journals.
TRANSPORT flag and parity as a test.
Phase B: published_at, the 202 point, GET visibility.
Single active control-plane process; what that means for availability.
Which timeout fires on an event-loop stall (from Spike 4).
What E1 and E2 prove and do not prove.

12. Interview prep for this week
Be able to answer from memory:
Kafka gives one consumer per partition. Why is that not enough? (Rebalance, long pause, frozen process: two owners believe they own it.)
Explain fencing in three layers. Which one is the safety guarantee? Why is the epoch check in the same statement as the insert? What does FOR SHARE buy?
What does the transactional producer add when the offsets live in Postgres? (Atomic batch, producer-epoch fencing of zombie output.) What does it not do? (It cannot be atomic with Postgres.)
Walk the crash windows KC1 to KC9. What is durable, what does recovery do, what can a consumer observe?
Why store the consume offset in Postgres? What breaks if you trust Kafka's committed offset?
Why can a redelivered OrderAccepted double-trade, and what stops it?
What does a JS event-loop stall look like to Kafka, and which timeout fires? How did you verify it?
Why does one hot symbol cap your throughput? What would you do about it? (Nothing for one book; reduce per-command cost; separate symbols.)
What does E2 prove and not prove? Why was the hypothesis written first?
What does Kafka mode still not do? (One control-plane process, no account.events, projector on journals, unbounded growth only in the bounded sense of 4.10.)
Whiteboard exercise (no notes): draw the shard write path with the nine crash windows, and for each say what is durable and what recovery does. Then draw the ownership lifecycle and explain why step 1 (lease) comes before step 3 (recover), with a timeline of a zombie waking up.

13. Common mistakes to avoid
Checking the lease in a separate statement from the insert
Recovering before acquiring the lease
Fencing commands but not events, offsets or watermarks
Trusting Kafka's committed offset instead of the stored offset
Using the client's default partitioner instead of explicit partitionOf
Continuing after a FencedWriterError or a fenced producer
Publishing events before they are journaled
Enqueuing buffered messages after a revoke
Dropping messages on FULL or buffering without bound
Sizing R11 against session.timeout.ms without verifying which timeout fires
Redelivering OrderAccepted without the journal lookup
Evicting a live order's id from the dedupe set
Letting inproc import the Kafka client
Writing the E2 hypothesis after seeing the numbers
Leaving it.todo or placeholder tests and reporting the week as done
Touching engine-core or ShardRunner.run() to make Kafka fit

14. Progress log (copy into PROGRESS.md each day)
Day N:
- Done:
- Failing / blocked:
- Test-ID table (ID, file, real+passing / failing / missing):
- Next failing test to write:
- Flaky tests seen (and root cause):
- Property-test seeds worth keeping:
- Which crash window or timeout surprised me:
- Decisions made:


15. Weeks 11 and 12: how the project ends fully running
What Week 10 must hand over: a kafka mode that matches inproc field by field, a fenced journal you can defend line by line, proof of zombie and stall handling (R7, R11), E1 passing, an E2 write-up, and a README that states what is still single-process.
Week
Focus
Done when
11
React UI tier 1 (P1 to P6) against the Week 9 API, P7 system dashboard (shard ownership and epochs from this week), prom-client metrics, Prometheus and Grafana (latency percentiles, throughput, queue depth, consumer lag, event-loop lag, breaker state), Phase B overflow, E2 re-run with dashboards
The 3-minute demo script runs from the browser; dashboards show epochs, lag and event-loop lag
12
k6 and Kafka producer load tests, profile (node --cpu-prof, --heap-prof), at least 3 measured optimizations in a before/after table (E3), deploy with Docker on one small VM, README with diagrams and limitations, 2 to 3 minute demo video, resume bullets from measured numbers
A stranger can run it in one command; the live demo link is stable

No buffer week remains, so the cut order is fixed now: P7 first, then tier-2 UI pages, then OpenTelemetry, then E3 down to exactly three optimizations. Deploy whichever transport mode passes its tests; inproc is the safe fallback.



