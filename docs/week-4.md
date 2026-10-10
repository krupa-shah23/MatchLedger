Week 4: Single-Writer Shard Runner, the Await Race, and the First End-to-End Benchmark
One-week working document. Put it in docs/WEEK-4.md. It covers blueprint "Week 4: Single-writer runner and first benchmark". Week 5 (journal in Postgres, snapshots, recovery) is previewed at the end. Time budget: 10 to 15 hours.
The theme of this week: the engine is already correct and synchronous. This week you build the impure code around it (the shard runner's input stage), and you build a deliberately naive concurrent-async risk check next to a serialized one so you can prove, with a deterministic test, that await is Node's race condition. Then you measure both, honestly.
Rule for this week: you hand-write the runner's processing loop and both risk handlers (naive and serialized). Those are the pieces you will whiteboard in interviews. AI tools may help with the bounded queue, ports and types, test scaffolding, the benchmark harness, and docs (section 9).

0. Status and carry-over from Week 3
Week 3 was implemented with an AI agent, so start with a verification day instead of trusting the green checkmarks.
#
Carry-over check
Done when
V1
Run the full gate from a clean state: npm ci && npm run build && npm run lint && npm run check:boundaries && npm test
All green
V2
Re-run the purity proof: add Date.now() to a file in engine-core/src, confirm lint fails, revert
git diff clean afterwards
V3
Read the IOC branch in apply and the reference matcher. Explain each line aloud
You can, without the doc
V4
Mutation check from Week 3 Prompt 4: break the IOC tail, flip the BUY comparison, read next after unlink; each must fail at least one property
Results recorded in PROGRESS.md
V5
docs/experiments.md has the Week 3 E3 baseline (B1 to B7) with environment block
Present. Re-run npm run bench on your own laptop if the numbers came from another machine
V6
Whiteboard Example 4 (IOC buy with cap 102 over asks 101, 102, 103) without notes
Done
V7
Week 1 leftovers (Docker items, spikes 3, 4, 6, 7, CI)
Ticked, or consciously deferred. Spike 4 (Kafka transactions and fencing) must be done by Week 5

If V3 or V6 fails, spend the time here. Weeks 4 to 6 build on the engine contract and you will be asked about it.

1. Goal and scope
Goal: wrap the finished engine in a single-writer shard runner (bounded queue, stamping, journal-before-apply, sequential processing, backpressure, fail-stop), build the naive-async and serialized risk prototypes, prove the overspend with a deterministic test, and record the first end-to-end numbers.
In scope this week
Deferred
BoundedQueue (promise-based, single consumer, no timers) in common
Postgres journal, (stream_id, seq) PK, fencing epoch (Weeks 5 and 10)
Ports in common: Clock, JournalAppender, EventSink, StampedCommand, ShardOutput
Snapshots, recovery, replay from the journal (Weeks 5 and 6)
ShardRunner in shard: multi-symbol, one queue, stamp (ts, per-symbol seq), journal then apply then publish, batching, yield, fail-stop, graceful stop
Tick injection and heartbeat (needs the breaker, Week 8)
In-memory journal and sink (test doubles that also serve the benchmarks)
Kafka, transactions, rebalance handling (Week 10)
Risk prototype in risk: NaiveRisk and SerializedRisk over an async in-memory account store, BUY cash reservation only
Real reservation lifecycle, fills, releases, sells, market orders, ledger (Week 7)
Concurrency tests C2, C2b, C3, C5, C6 and the new shard tests SH1 to SH14
C1 (the full three-symbol version) stays in Week 7
First end-to-end benchmarks: F2a (single shard) and F3 (naive vs serialized), plus micro benchmarks B8, B9
Any optimization (Week 11)


2. Deliverables and definition of done
[ ] V1 to V7 done (section 0)
[ ] common: BoundedQueue and the port types, with BQ1 to BQ6 passing
[ ] shard: ShardRunner, InMemoryJournal, CollectingSink, system Clock, yieldToEventLoop
[ ] risk: AsyncAccountStore (in-memory, injectable delay), NaiveRisk, SerializedRisk, shared pure decide()
[ ] Dependency map and scripts/check-boundaries.mjs updated for the changes in section 4.7
[ ] All tests in section 8 pass: BQ1 to BQ6, SH1 to SH14, SP1, SP2, RK1, C2, C2b, C3, C5, C6
[ ] Flake gate: the whole concurrency suite passes 20 out of 20 times in a loop (section 8.6)
[ ] npm run bench extended with B8 and B9; npm run bench:e2e runs F2a and F3; results in docs/experiments.md with the hypotheses written before the run
[ ] npm run build, lint, check:boundaries, test green; CI green
[ ] docs/decisions.md: decision #1 written in full, plus the decisions in section 10
[ ] PROGRESS.md updated (deviations, flaky-test notes, seeds)
[ ] You can draw the naive race line by line and the serialized fix from memory (section 11)
Definition of done: you have a comparison table (naive vs serialized: throughput, p50/p95/p99, event-loop lag, overspend) and you can explain the await race from memory without notes.

3. Technologies and tech stack (this week only)
Tool
Version
Used for
Node.js
24 LTS (unchanged)
Event loop is the single writer
TypeScript
6.0.x strict (unchanged)
All packages
Vitest
4.1.x (unchanged)
Tests. Concurrency tests must be deterministic (section 8.6)
fast-check
4.x (unchanged)
SP1, SP2: random commands, random delay schedules, random clock readings
tinybench
as pinned in Week 3
B8, B9 micro benchmarks
node:perf_hooks
built in
monitorEventLoopDelay (event-loop lag), createHistogram (latency percentiles), performance.now
node:timers/promises (setImmediate)
built in
yieldToEventLoop in the shard runner and the "I/O hop" in the account store
process.hrtime.bigint()
built in
Latency stamps in benchmarks only

Not used this week: Kafka client, pg, Redis, Fastify, prom-client, zod. No new npm dependencies at all. If you feel you need one, stop and ask why.
Where impure APIs may appear: shard (clock, timers) and benchmarks (perf hooks, node:os) may use node:*. engine-core stays pure. common must stay browser-safe, so BoundedQueue uses promises only: no timers, no node:*.

4. Architecture
4.1 What goes where
packages/common/
  src/bounded-queue.ts      // BoundedQueue<T>: tryEnqueue, dequeue, drainSync, close
  src/shard-ports.ts        // Clock, StampedCommand, ShardOutput, JournalAppender, EventSink (types)
  test/bounded-queue.test.ts  // BQ1 to BQ6
packages/shard/
  src/shard-runner.ts       // ShardRunner (the loop you hand-write)
  src/stamper.ts            // Stamper: ts = max(lastTs, clock.now()), per-symbol seq
  src/in-memory-journal.ts  // InMemoryJournal (records every appended batch; injectable gate/failure)
  src/collecting-sink.ts    // CollectingSink (records outputs; injectable gate/failure)
  src/system-clock.ts       // { now: () => Date.now() }
  src/yield.ts              // yieldToEventLoop() via setImmediate
  src/index.ts
  test/                     // SH1 to SH14, SP1, SP2
packages/risk/
  src/account-store.ts      // AsyncAccountStore (copies on read, injectable delay)
  src/decide.ts             // pure decide(state, need) shared by both versions
  src/naive-risk.ts         // the buggy two-await version (hand-write)
  src/serialized-risk.ts    // the awaited-loop version (hand-write)
  test/                     // RK1, C2, C2b, C6
packages/benchmarks/
  src/book.bench.ts         // + B8 (stamper), B9 (queue)
  src/e2e.bench.ts          // F2a, F3 harness (custom, not tinybench)

4.2 The shard pipeline (one process, one event loop, one writer)
flowchart LR
    P1[Producers<br/>gateway / simulator / risk] -->|"tryEnqueue(symbol, cmd)<br/>ACCEPTED / FULL / UNKNOWN_SYMBOL / CLOSED"| Q[(BoundedQueue<br/>capacity N)]
    Q -->|"await dequeue() + drainSync(maxBatch-1)"| S[Stamp each command<br/>ts = max(lastTs, clock.now())<br/>seq = per-symbol counter]
    S -->|"await journal.append(batch)"| J[(Journal port<br/>in-memory this week)]
    J --> E["engine.apply(cmd)<br/>SYNC, one OrderBook per symbol"]
    E -->|"await sink.publish(outputs)"| K[(EventSink port)]
    K --> Y["await yieldToEventLoop()<br/>(setImmediate)"]
    Y --> Q

Rules baked into the picture:
One consumer loop. The loop never starts the next batch before the previous one has been fully journaled, applied and published. That is the entire single-writer guarantee. No Promise.all over commands, anywhere.
Stamp on dequeue, in the loop, so ts and seq follow the exact order the engine will see.
Journal before apply. If the journal append rejects, nothing was applied and nothing was published. (Week 5 turns the in-memory journal into Postgres without changing this ordering.)
The engine call is synchronous. The awaits are all around it, never inside it.
Backpressure is explicit. A full queue returns FULL to the producer. The runner never buffers without bound. A slow sink slows the loop, which fills the queue, which pushes back on producers.
Yield between batches so heartbeats, timers and I/O callbacks run (blueprint 4.5, item 9).
4.3 Contracts (ports in common, types only plus Clock)
export interface Clock { now(): number }                       // ms, injected; tests use a fake

export type StampedCommand = {
  readonly symbol: string;       // stream_id in Week 5
  readonly seq: number;          // per-symbol, starts at 1, contiguous, no gaps
  readonly ts: number;           // non-decreasing across the whole shard
  readonly command: EngineCommand; // engine-core command with ts overwritten by the stamper
};

export type ShardOutput = {
  readonly symbol: string;
  readonly seq: number;
  readonly ts: number;
  readonly command: EngineCommand;
  readonly events: readonly EngineEvent[];
};

export interface JournalAppender {
  // all-or-nothing; resolves when the whole batch is durable, in array order; rejects on failure
  append(batch: readonly StampedCommand[]): Promise<void>;
}
export interface EventSink {
  // resolves when the batch has been handed off, in order
  publish(batch: readonly ShardOutput[]): Promise<void>;
}

BoundedQueue<T> (single consumer):
Method
Behaviour
tryEnqueue(item): boolean
false when full or closed. Never throws on full. O(1)
dequeue(): Promise<T | undefined>
Resolves immediately if an item is available, else waits. Resolves undefined when the queue is closed and empty. A second concurrent dequeue() while one is pending throws (single consumer is enforced)
drainSync(max): T[]
Takes up to max items that are already queued, without waiting
close()
No new items; queued items remain readable; a pending dequeue() resolves undefined if empty
size, capacity, isClosed
Read-only

Implement it as a ring buffer (fixed array, head index, count) so enqueue and dequeue are O(1) with no array shifting. Capacity must be a positive integer.
ShardRunner public surface:
type EnqueueResult = 'ACCEPTED' | 'FULL' | 'UNKNOWN_SYMBOL' | 'CLOSED';
type RunnerState = 'IDLE' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'FAILED';
type ShardExit = { reason: 'STOPPED' } | { reason: 'FAILED'; error: unknown };

class ShardRunner {
  constructor(opts: {
    symbols: ReadonlyMap<string, InstrumentSpec>;  // one OrderBook per symbol
    clock: Clock; journal: JournalAppender; sink: EventSink;
    queueCapacity: number; maxBatch: number;
    yieldFn?: () => Promise<void>;                  // default: yieldToEventLoop
    onFatal?: (error: unknown) => void;
  });
  tryEnqueue(symbol: string, command: EngineCommand): EnqueueResult;
  start(): void;
  stop(opts?: { drain?: boolean }): Promise<void>;  // default drain: true
  readonly state: RunnerState;
  readonly done: Promise<ShardExit>;                // never rejects
}

Unknown symbols are rejected at tryEnqueue, before stamping or journaling, so garbage never pollutes the journal or consumes a seq.
4.4 The loop (pseudocode; write the real code yourself)
async run():
    try:
        for (;;):
            first = await queue.dequeue()          // waits when empty
            if first === undefined: break          // closed and drained
            items = [first, ...queue.drainSync(maxBatch - 1)]

            stamped = items.map(i => stamper.stamp(i.symbol, i.command))   // sync, in order
            await journal.append(stamped)          // durable BEFORE the engine sees it

            outputs = []
            for s of stamped:
                events = books.get(s.symbol).apply(s.command)   // sync engine
                outputs.push({ symbol, seq, ts, command, events })

            await sink.publish(outputs)            // in order, awaited
            await yieldFn()                        // let the event loop breathe
        state = STOPPED
    catch (err):
        state = FAILED; queue.close(); onFatal(err); resolve done with FAILED
        // never apply another command after this point

Why this is safe even though there are awaits inside: only this one loop ever touches the books and the stamper, and it never starts a second iteration before the first completes. Producers only touch the queue, which is a plain data structure with no await between its read and its write.
4.5 The await race, line by line (the thing this week proves)
The naive risk handler (prototype of the blueprint's "naive concurrent-async version"):
async function handleNaive(req: ReserveRequest) {          // one call per incoming message, NOT awaited by a loop
  const acct = await store.read(req.accountId);            // (1) read   -- other handlers run here
  if (acct.cash - acct.held < req.need) return reject();   // (2) check on a STALE snapshot
  await store.write(req.accountId, { ...acct, held: acct.held + req.need }); // (3) write -- lost update
  return accept();
}

Timeline for cash = 100, two BUY orders A and B needing 80 each, called back to back without a loop:
Step
Event
Stored state
t0
A calls read and suspends
{cash 100, held 0}
t1
B calls read and suspends (A has not written yet)
{cash 100, held 0}
t2
A resumes: snapshot {100, 0}, 100 - 0 >= 80, passes


t3
B resumes: snapshot {100, 0} (stale), passes


t4
A writes held = 80
{100, 80}
t5
B writes held = 80 (overwrites; lost update)
{100, 80}
end
Both accepted. Committed demand is 160 against cash 100: overspend 60. Stored held (80) does not even match what was committed (160)



Two things to notice. First, there is no thread here: this is a pure interleaving at await points. Second, an atomic incrementHeld in the store would fix the lost update but not the check-then-act race on the stale read. The fix is not "fewer awaits" and not "a lock"; it is to make sure no second handler for the same state starts until the first finishes.
The serialized version keeps the same awaits and the same decide(), and only changes scheduling:
// submit(): enqueue a message and a deferred promise; a single loop drains the queue
async loop() {
  for (;;) {
    const msg = await queue.dequeue();
    if (!msg) break;
    const acct = await store.read(msg.req.accountId);         // same awaits as the naive version
    const { result, next } = decide(acct, msg.req);           // pure, shared
    if (next) await store.write(msg.req.accountId, next);
    msg.resolve(result);                                       // next message starts only after this
  }
}

4.6 Class and flow overview
sequenceDiagram
    participant A as Handler A (naive)
    participant B as Handler B (naive)
    participant S as AsyncAccountStore
    A->>S: read(acct)
    B->>S: read(acct)
    S-->>A: {cash 100, held 0}
    S-->>B: {cash 100, held 0}
    A->>S: write(held 80)
    B->>S: write(held 80)
    Note over A,B: both accepted, committed 160 > cash 100

sequenceDiagram
    participant M as Messages A, B
    participant L as SerializedRisk loop
    participant S as AsyncAccountStore
    M->>L: enqueue A, enqueue B
    L->>S: read(acct) for A
    S-->>L: {100, 0}
    L->>S: write(held 80)
    Note over L: A done, only now B starts
    L->>S: read(acct) for B
    S-->>L: {100, 80}
    Note over L: 100 - 80 < 80, B rejected INSUFFICIENT_BALANCE

4.7 Dependency map changes (update blueprint 4.4 and check-boundaries.mjs in the same commit)
Package
Change
Why
common
Adds bounded-queue.ts and shard-ports.ts; still depends only on engine-core types (and zod, unused)
Both shard and risk need the queue, and the journal package (Week 5) must implement JournalAppender without importing shard (no cycle)
shard
May depend on engine-core, common (and later journal, the Kafka client). No Kafka import this week
Runner is Kafka-free until Week 10
risk
May depend on common only this week
Prototype uses the shared queue
benchmarks
Deviation: now engine-core, common, shard, risk, tinybench. Still no Fastify, no Kafka as direct dependencies
F2a and F3 are end-to-end and need the real runner and risk code. Record this as a decision and edit blueprint 4.4

Then re-run the boundary proof: add a forbidden dependency, confirm the checker fails, revert.
4.8 Test architecture
flowchart LR
    G[fast-check: commands,<br/>delay schedules, clock readings] --> R[ShardRunner<br/>with gated InMemoryJournal + sink]
    R --> OUT[outputs + journaled stamped commands]
    OUT --> ORC[Oracle: fresh sync OrderBook<br/>fed the journaled stamped commands in order]
    OUT --> CMP{SP1: events deep-equal}
    ORC --> CMP
    OUT --> INV[SH4/SP2: seq contiguous,<br/>ts non-decreasing]
    G2[Controlled interleavings:<br/>manual gates, microtask yields] --> RK[NaiveRisk / SerializedRisk]
    RK --> C[C2, C2b, C6: overspend,<br/>max concurrency, decision order]


5. How to build it (day by day)
Write the failing test first each day, then the code. All concurrency tests are deterministic: no real sleeps, no setTimeout. Control interleavings with injected delays (microtask or setImmediate yields) and manually resolved gates.
Day
Hours
Do
Done when
1
2
V1 to V7. Update the dependency map and the boundary checker for section 4.7. Add the ports (shard-ports.ts). Write the failing BQ1 to BQ6
Gate green; boundary proof re-run; BQ tests exist and fail for the right reason
2
2
Implement BoundedQueue (ring buffer). Implement Stamper, InMemoryJournal, CollectingSink, system-clock, yield. Write failing SH1 to SH14
BQ1 to BQ6 green; SH tests written
3
2 to 3
Hand-write ShardRunner.run() (section 4.4). Make SH1 to SH14 pass. Then SP1, SP2
Runner tests and properties green; no Promise.all over commands
4
2
AsyncAccountStore, decide(), hand-write NaiveRisk and write C2 first (it must show the overspend). Then hand-write SerializedRisk, C2b, RK1, C6
C2 proves overspend deterministically; C2b and C6 pass
5
2
C3 and C5 through the real shard runner. Run the 20x flake loop on the whole concurrency suite
20/20 green; any flake fixed at the root, not retried
6
2 to 3
Benchmarks: B8, B9 (tinybench), then e2e.bench.ts for F2a and F3. Write hypotheses into docs/experiments.md before running. Run, record, explain deviations
Tables committed with environment block
7
1 to 1.5
Decision #1 and the others (section 10), complexity notes, PROGRESS.md, whiteboard (section 11), cleanup
Docs done, everything green, CI green

Stuck protocol: if a concurrency bug costs more than 90 minutes, stop and shrink it to the smallest interleaving that fails: two messages, one account, manual gates. Draw the timeline like the table in 4.5. Debug the timeline, not the 5,000-message run.
5.1 Stamper (the small impure piece)
stamp(symbol, command):
    reading = clock.now()
    if !Number.isFinite(reading): throw        // fail-stop: a bad clock is a runtime fault
    lastTs = max(lastTs, reading)              // non-decreasing across the whole shard
    seq = (seqBySymbol.get(symbol) ?? 0) + 1   // contiguous per symbol
    seqBySymbol.set(symbol, seq)
    return { symbol, seq, ts: lastTs, command: { ...command, ts: lastTs } }

ts only measures elapsed time. Ordering is by seq. The input stage overwrites whatever ts the producer supplied.
5.2 Account store and decision function (risk prototype)
type AccountState = { cash: bigint; held: bigint }       // bigint only
decide(state, need):
    if need <= 0n: reject INVALID_AMOUNT
    if state.cash - state.held < need: reject INSUFFICIENT_BALANCE
    accept; next = { cash: state.cash, held: state.held + need }

AsyncAccountStore:
read(id) returns a copy of the stored state after await delay(). If it returned the stored object itself, a naive handler would mutate shared state in place and the lost-update race could disappear or change shape. This is a classic way to accidentally "pass" the naive test.
write(id, state) stores a copy after await delay().
delay is injectable: microtask (await Promise.resolve()), macrotask (await setImmediate), or a schedule-driven delay (a list of yield counts from a fast-check array) so interleavings are reproducible and shrinkable.
Unknown account: read rejects with a typed error (documented behavior, tested).
Prototype scope: BUY orders only; need = price (ticks) times quantity (lots) as bigint. SELL orders skip risk this week. Week 7 replaces this with the real reservation lifecycle (place, convert, release) and shares. Keep these files small and labelled PROTOTYPE.

6. Worked scenarios (use as test fixtures)
Scenario 1: the overspend (C2)
Account acc1, cash 100n, held 0n. Two BUY requests, each need 80n, submitted concurrently (both calls started in the same synchronous turn), store delay = microtask.
Version
Expected
NaiveRisk
Both accepted. committed = 160n > cash 100n. Stored held is 80n, which does not equal committed (lost update). The test asserts the overspend happens and is kept as proof
SerializedRisk (C2b)
First accepted, second rejected INSUFFICIENT_BALANCE. committed = 80n <= cash. Stored held = 80n = committed

Scenario 2: scale (C2 and C2b at volume)
One account cash 1_000n, 500 requests of need 10n (total demand 5,000n), all started concurrently.
Version
Expected
Naive
committed far above 1,000n. Assert committed > cash and stored held != committed
Serialized
Exactly 100 accepted (the first 100 in arrival order), 400 rejected, committed = 1_000n, held = 1_000n; decisions in arrival order

Scenario 3: cancel races a fill (C3)
Book: SELL o1 @100 q10 rests. Concurrent producers enqueue, in an interleaving the test records: Cancel(o1) and BUY o2 @100 q10 IOC.
Arrival order in the queue
Expected outcome
Cancel first
o1 cancelled (USER_REQUEST), IOC finds nothing and is cancelled (IOC_REMAINDER), no trade
IOC first
Trade 10@100, then CancelRejected(UNKNOWN_ORDER) for the cancel

Never both a cancel and a fill for o1. The outcome always equals a synchronous replay of the commands in the recorded arrival order.
Scenario 4: runner example
Symbols ACME (tick 1, lot 1) and BETA. Clock readings: 1000, 1000, 990 (clock stepped back), 1005. Commands enqueued in order: ACME, BETA, ACME, ACME.
Command
ts stamped
seq
ACME #1
1000
ACME 1
BETA #1
1000
BETA 1
ACME #2
1000 (clamped, not 990)
ACME 2
ACME #3
1005
ACME 3


7. Edge cases to handle
Queue
Capacity 0, negative or non-integer: constructor throws
Enqueue when full returns false; no item lost, no existing item overwritten
Ring buffer wrap-around after many enqueue/dequeue cycles at capacity 1, 2, 3
dequeue() pending when an item arrives resolves immediately with it; pending when closed resolves undefined
Second concurrent dequeue() is a programming error and throws
close() twice is harmless; enqueue after close returns false; items queued before close are still delivered
drainSync(0) returns []; drainSync never waits
Stamper and ordering
Clock goes backwards: ts clamps (never decreases), seq still increases
Clock returns the same value for many commands: equal ts is fine, seq is the order
Clock returns NaN or Infinity: fatal
Supplied ts on the incoming command is overwritten
seq contiguous per symbol with no gaps across interleaved symbols, and across batch boundaries
Per-symbol order equals enqueue order for that symbol (cross-symbol interleaving is allowed)
Runner
Unknown symbol: UNKNOWN_SYMBOL at enqueue; no seq consumed; nothing journaled
Full queue: FULL; after the loop catches up, enqueue succeeds again
Journal append rejects: engine not applied, nothing published, runner FAILED, queue closed, no later command applied, onFatal called exactly once
Sink rejects: same fail-stop (the batch was journaled and applied; Week 5 recovery handles republishing; document it)
Engine throws (inject a throwing engine via a test seam or a poisoned spec): fail-stop
stop({drain: true}): all queued commands are journaled, applied and published, then STOPPED; enqueue after stop returns CLOSED
stop({drain: false}): no new batch starts; the in-flight batch completes (never abandon between journal and apply); remaining queued commands are discarded and reported by count
stop() twice, or stop() before start(): defined and harmless
start() twice throws
A very large backlog (10,000 queued, maxBatch 100): the runner yields to the event loop between batches (SH7)
Slow journal or slow sink while producers keep enqueueing: bounded growth only up to queueCapacity
Risk prototype
need <= 0n: INVALID_AMOUNT
Order exactly equal to available: accepted; one unit above: rejected
Unknown account: typed error, never a silent accept
Store write rejects in SerializedRisk: the loop fails, the in-flight and queued messages reject with the error, and the instance is FAILED (RK1). A loop that swallows the error and keeps going, or dies silently with unresolved promises, is a bug
Many accounts through one serialized loop: decisions per account follow arrival order
Engine contract
The runner never calls the engine from two places, and never between journal.append start and its resolution
engine-core is untouched this week (git diff on packages/engine-core/src must be empty, or the change explained)

8. Test cases to pass
IDs C2, C3, C5, C6 come from blueprint 10.3. C2b, BQ1 to BQ6, SH1 to SH14, SP1, SP2, RK1 are new; add them to the blueprint tables.
8.1 BoundedQueue (common)
#
Test
Expected
BQ1
Enqueue 1..n then dequeue n times
Same order (FIFO)
BQ2
Fill to capacity, enqueue once more
false; contents unchanged
BQ3
dequeue() on empty, then enqueue
Pending promise resolves with that item
BQ4
close() with a pending dequeue() and with queued items
Pending resolves undefined if empty; queued items drain, then undefined
BQ5
Two concurrent dequeue() calls
Second throws
BQ6
Property (fast-check) against an array model: random sequences of enqueue, dequeue, drainSync at small capacities
Behavior identical to the model; size always correct; boundary check proves no timers and no node:* in common

8.2 ShardRunner (shard)
#
Test
Expected
SH1
Clock steps backwards (Scenario 4)
ts non-decreasing; engine events echo the stamped ts
SH2
Command arrives with its own ts
Overwritten by the stamper
SH3
Journal gate closed (append pending)
Engine has applied nothing and sink has published nothing until the gate opens. Then both happen, in order
SH4
Two symbols, interleaved enqueues, batches of 3
Per-symbol seq is 1..n contiguous; journal order equals processing order
SH5
Same-symbol commands
Applied in enqueue order
SH6
Unknown symbol
UNKNOWN_SYMBOL; no seq consumed; journal untouched
SH7
10,000 queued, maxBatch 100, a setImmediate probe
The probe runs before the backlog is finished (the loop yields). Also assert the journal received batches of at most 100
SH8
Backpressure: gate the journal, capacity K, enqueue K+5
Exactly K ACCEPTED, 5 FULL; after opening the gate all K processed, none lost
SH9
Journal rejects
Runner FAILED; engine not applied for that batch; nothing published; queue closed; onFatal once; done resolves FAILED
SH10
Sink rejects
FAILED, no further batch processed
SH11
stop({drain: true}) with a backlog
All processed then STOPPED; later enqueue CLOSED; stop() again is a no-op
SH12
stop({drain: false}) mid-batch
In-flight batch completes (journal, apply, publish); the rest discarded; count reported
SH13
Slow sink
Outputs published in order; no reordering; producers see FULL when the queue fills
SH14
Clock returns NaN
FAILED; nothing from that batch applied or journaled

8.3 Runner properties (fast-check)
#
Property
SP1
Runner equals synchronous replay. For random command sequences, random batch sizes and random journal/sink delay schedules, the runner's outputs equal the events produced by a fresh synchronous OrderBook fed the journaled stamped commands in journal order. This is the seed of P7 (replay equals live, Week 5)
SP2
For random clock readings (including backwards steps and repeats) and random symbols: ts is non-decreasing, each symbol's seq is exactly 1..n, and journal order equals processing order

Use at least 500 runs for SP1 (each run is async; keep sequences to about 100 commands) and 1,000 for SP2. Print the seed on failure.
8.4 Concurrency tests (the evidence)
#
Test
Expected
C2
Scenarios 1 and 2 against NaiveRisk
Overspend is demonstrated deterministically: committed > cash and stored held != committed. The test passes because the bug is present. Keep it forever as proof
C2b
Same scenarios against SerializedRisk
committed <= cash, held == committed, decisions in arrival order
C6
Inject random delays (a fast-check array of yield counts) at every await in the store, and also inside the handler, then send many messages for one account
Serialized: max observed concurrency is 1, and decisions plus final state are identical across all delay schedules. Naive: max observed concurrency > 1 (document it; this also shows why a probabilistic race test would be flaky and why deterministic delays are needed)
C3
Scenario 3 at volume: many producers concurrently enqueue cancels and crossing orders for the same resting order through the real runner, with random journal delays
Exactly one outcome per order; the runner's events equal a synchronous replay of the commands in recorded arrival order; conservation holds (filled + cancelled + resting == quantity)
C5
50 accounts x 200 orders to one symbol from concurrent producers (random yields between enqueues), then drain
Every submitted command appears exactly once in the journal and outputs (count and unique ids); total BUY fills equal total SELL fills; runner events equal synchronous replay of the journal order; no lost or duplicated orders
RK1
SerializedRisk with a store whose write rejects on the Nth call
Loop fails; in-flight and queued messages reject with that error; no unresolved promises; later submit rejects immediately

8.5 Benchmarks (not pass/fail, but must run, hypotheses first)
#
What
Report
B8
tinybench: Stamper.stamp
ops/sec, margin
B9
tinybench: queue tryEnqueue + dequeue pair (no waiting)
ops/sec, margin
F2a
Single shard end to end: producers to BoundedQueue to stamp to InMemoryJournal to engine to CollectingSink, no real I/O
Throughput, p50/p95/p99 enqueue-to-outcome latency, event-loop delay p99
F3
Naive concurrent-async vs serialized, feeding the same shard runner, with the matrix below
Throughput, p50/p95/p99, event-loop delay p99, accepted, rejected, overspend, invariant violated (yes/no)

F3 matrix (each cell run 5 times; report median and min to max): accounts {1, 100} x store delay {microtask, setImmediate} x mode {naive, serialized}. About 20,000 BUY orders per run, per-account cash set to about 25% of that account's total demand, so the naive version overspends for certain.
Hypotheses (write these into docs/experiments.md BEFORE running; edit only by adding a "Result" line):
H1: serialized overspend is exactly zero in every cell; naive overspend is greater than zero in every cell where more than one handler is in flight.
H2: with a microtask store delay the two modes have similar throughput (little latency to overlap).
H3: with a setImmediate store delay the naive mode shows higher raw throughput, because it overlaps store latency while the serialized loop pays it per message. If true, that is the honest cost of correctness here, not a failure of the design.
H4: the hot-account cell (accounts = 1) changes the naive mode's overspend dramatically and the serialized mode's throughput very little.
Write down what each result does not prove: one machine, simulated in-memory store latency (not a real database), no Kafka, prototype risk logic, one process.
8.6 Determinism and the flake gate
No setTimeout/real sleeps in concurrency tests. Interleavings come from injected yields and manual gates.
Seeded or fast-check-generated schedules only (never Math.random in tests).
Flake gate: for i in $(seq 1 20); do npx vitest run packages/shard packages/risk packages/common || break; done (or the PowerShell equivalent) must pass 20 out of 20 times. A test that fails once in 20 is a bug in the test or the code. Do not add retries.

9. Rules for this week
engine-core stays pure and unchanged. shard may use node:* and timers; common may not; risk should not need either (use injected delay functions).
No Promise.all (or forEach(async ...)) over commands or messages that must be ordered, in shard or in SerializedRisk. NaiveRisk is the one deliberate exception, and it lives in a file marked as the intentionally buggy comparison.
Every await in the runner loop is deliberate: be able to say what could happen on the event loop during it.
Commit after every green test; leave PROGRESS.md saying what is done and the next failing test.
AI tools this week. Allowed: BoundedQueue, ports, InMemoryJournal, CollectingSink, test scaffolding, fast-check generators, the benchmark harness, docs, reviews. Not allowed: ShardRunner.run(), NaiveRisk, SerializedRisk. You defend those line by line.
If a blueprint statement conflicts with a measurement, the measurement wins; log it under "Decisions and deviations". In particular, blueprint 16.4 says the single-writer version is "both faster and correct". Do not repeat that claim unless F3 shows it. The defensible claim is: correct always; faster or slower depending on the measured configuration.

10. Decisions to record in docs/decisions.md this week
Format: context, options, choice, trade-offs, how tested.
Decision #1 (blueprint): one synchronous writer per shard vs concurrent async handlers. Options: concurrent handlers with optimistic retries, per-account mutex, DB row locks or compare-and-set, serialized awaited loop. Choice: serialized loop per partition. Trade-offs: throughput under high store latency (measured in F3), hot account or hot partition serial. Tested by C2, C2b, C6, F3.
Stamp on dequeue, in the loop. ts = max(lastTs, clock.now()), per-symbol seq for ordering. Why not stamp at enqueue: producers are concurrent and ts must follow the order the engine sees. Tested by SH1, SH2, SP2.
Journal before apply, awaited, per batch. Why: a crash after apply but before journal would lose a command the world has seen. Tested by SH3, SH9.
Backpressure: tryEnqueue returns FULL; the runner never buffers without bound. The caller decides (gateway will return 503 or 429 later). Tested by SH8, SH13.
Sink is awaited in order, and the loop yields between batches. Cost: a slow sink slows the engine; benefit: no unbounded memory, no heartbeat starvation. Tested by SH7, SH13.
Fail-stop on any error in the loop. Never continue in an unknown state; supervisor restarts (wired in Week 10). Tested by SH9, SH10, SH14.
Ports live in common, implementations in shard and (Week 5) journal. Avoids a journal -> shard cycle.
BoundedQueue has no timers and no node:*. Keeps common browser-safe and the queue deterministic to test. Tested by BQ6 and the boundary check.
Risk prototype is throwaway scope. BUY cash only, in-memory store; Week 7 replaces it. The naive file is kept as permanent proof.
Why test the race deterministically. Injected yields and gates instead of timers; a probabilistic test would be flaky and prove nothing. Tested by C2, C6, the 20x flake gate.
Dependency map deviation for benchmarks. Why the end-to-end harness needs shard and risk, and what is still forbidden.
Ticks are deferred. The input stage will inject Tick(ts) once the breaker exists (Week 8); StampedCommand.command is designed as a union so it fits.

11. Interview prep for this week
Be able to answer from memory:
Why is Node's event loop a natural single writer? What is the only way two things can interleave in Node, and where does that happen in your code?
Draw the naive handler's timeline for two orders and one account. Where exactly is the stale read? Why does an atomic increment in the store not fix it?
Why is serializing better than a mutex here? What does the loop cost (hot partition, latency per message) and what did F3 actually measure?
Why does the runner journal before it applies? What breaks if you apply first?
Why stamp ts on dequeue and not on enqueue? Why max(lastTs, now)? Why order by seq and not ts?
Why must the loop yield between batches? What happens to heartbeats and Kafka session timeouts if it does not? (An await-only loop over already-resolved promises can starve timers and I/O: microtasks run to completion before the next macrotask.)
What does FULL mean for the gateway, and what are the alternatives (block, drop oldest, unbounded) and why is each worse?
What does fail-stop protect you from? Why is "log and continue" dangerous in a matching engine?
Why must AsyncAccountStore.read return a copy?
Why can the pitch not say "faster" unless F3 says so?
Whiteboard exercise (no notes): two orders A and B, one account with cash 100, each needing 80. Draw the timeline for the naive handler (read, read, check, check, write, write) and mark the stale snapshot and the lost update. Then draw the serialized loop for the same two messages and show where B starts and what it reads. Finally draw the shard pipeline from tryEnqueue to yieldFn and mark which steps are awaited and which is synchronous.

12. Common mistakes to avoid
await Promise.all(items.map(...)) in the runner or in SerializedRisk (this reintroduces the exact bug)
Stamping at enqueue, or letting producers choose ts
Calling engine.apply before the journal append resolves
An unbounded queue "just for now"
No yield between batches, so timers and I/O starve
AsyncAccountStore.read returning the stored object by reference
Making the naive test probabilistic (real timers, Math.random) instead of deterministic
A serialized loop that catches and swallows errors and keeps running, or dies and leaves promises forever pending
Letting onFatal run more than once, or applying commands after FAILED
Using ts (not seq) to order anything
Counting overspend from the stored held instead of committed (the stored value is corrupted by the lost update, which is part of the bug)
Comparing naive and serialized with different decide() logic or different shard feeding, so the comparison measures the wrong thing
Reporting a single run, or numbers from a different machine than the one written in the table
Claiming the serialized version is "faster" without F3 saying so
Editing hypotheses after seeing results (add a "Result" line instead)
Touching engine-core/src this week without a written reason

13. Progress log (copy into PROGRESS.md each day)
Day N:
- Done:
- Failing / blocked:
- Next failing test to write:
- Flaky tests seen (and root cause):
- Property-test seeds worth keeping:
- Decisions made:
- Benchmark notes (hardware, Node version):


14. Week 5 preview (not this week)
Week 5 replaces the in-memory journal with the real thing: the journal package (PostgreSQL, (stream_id, seq) primary key, batched multi-row inserts, BIGINT money), the money codec at the Postgres boundary (Spike 7 and P10), snapshots, snapshot-plus-tail recovery, idempotency by clientOrderId at the gateway and again at the risk stage, and the chaos harness (R1 to R3, R6) plus property P7: replay equals live. SP1 from this week is its in-memory ancestor.
What Week 4 must hand over: a JournalAppender port that Postgres can implement unchanged, a runner whose ordering (stamp, journal, apply, publish) does not change, per-symbol contiguous seq, a flake-free concurrency suite, and the first comparison table. Also finish Spike 4 (Kafka transactions and fencing) before Week 10 at the latest; Week 5 is the safe slot.

