MatchLedger: Event-Sourced Order Matching and Settlement Engine (Node.js / TypeScript Edition)
A Node.js + TypeScript + React project designed for SDE interviews at financial-services and technology-consulting companies (UBS, Morgan Stanley, Apollo, ZS and similar). Built around three hard problems: concurrency, correctness of money, and crash recovery.
How to use this document: read sections 1 to 8 once to understand the project, then use sections 9 to 14 as your working checklist, and section 15 as your weekly plan. Section 16 is for interview prep.
Honesty note: the company "problems" referenced here are inferred from public job postings, press releases and interview reports. They are not knowledge of anyone's internal systems. In interviews, say "a problem of this kind" and ask how they handle it.
Edition note: this is the Node.js / TypeScript edition and replaces the Java / Spring Boot edition. The design decisions from earlier reviews are carried over unchanged in substance: one durable ingress path (5.6), single-writer ownership enforced by fencing (5.7), time as a journaled input (5.8), bounded market-order reservations (5.9), and an explicit long-halt policy (5.3). What changed is the implementation language and tooling. Versions were checked on 1 October 2026 (section 4.3), and TypeScript is pinned to 6.0.x on purpose (4.5, item 1).
What this edition gives up: the project no longer exercises Java-specific interview topics (thread pools, Runnable vs Callable, locks and the Java memory model). Section 14 explains how to cover that gap separately.

Table of Contents
Problem Statement
Solution Overview
The Application
Technologies and Tech Stack
Architecture
Core USPs
Why This Is Attractive for SDE Roles
Features
Edge Cases to Handle
Test Cases to Pass
Scaling Plan and Experiments
Design Decisions You Must Be Able to Defend
How to Present on Your Resume
Company-Specific Tailoring
Weekly Plan
Interview Pitch and Q&A
Scope Control and Common Mistakes
Repository Structure and README Checklist

1. Problem Statement
Financial systems that trade, settle and report on assets must satisfy requirements that ordinary CRUD applications never face:
Requirement
What goes wrong without it
Correct ordering. Orders at the same price must be filled first-come-first-served.
Unfair fills, regulatory problems, disputes.
Money correctness. Balances and positions must always add up.
Overspending, phantom positions, books that don't balance.
No double processing. A retried or duplicated message must not create a second trade.
Duplicate trades and double-debited accounts.
Crash recovery. After a failure, state must be rebuilt exactly.
Lost or duplicated orders, unknown account state.
Auditability. Every decision, including every rejection, must be explainable after the fact.
Inability to answer "why was this order rejected or filled?"
Reconciliation. Internal records must agree with external ones (brokers, custodians, administrators).
Silent mismatches that surface weeks later.
Scalability. Throughput must grow with load without breaking the guarantees above.
Either slow systems or fast-but-wrong systems.

The core tension: matching must be serial per instrument (order matters), but risk checks are per account and cross instrument boundaries. Scaling this system means sharding by symbol, which creates a consistency problem for account-level limits.
Problem statement in one line:
Build a trading engine that matches orders fairly, never lets an account overspend (even when it trades across many symbols on many shards), recovers exactly from crashes, proves its own correctness through replay and reconciliation, and scales out with measured evidence.

2. Solution Overview
MatchLedger is an event-sourced order matching and settlement engine with these design pillars:
Per-symbol order books with price-time priority, each owned by a single writer: one shard process, one event loop, one synchronous engine (no locks, deterministic ordering).
Account-level risk stage that serializes decisions per account and uses reservations (holds on cash or shares) so an account cannot overspend across symbols or shards.
Event sourcing: every state change is an immutable event in an append-only log. State is rebuilt by re-executing journaled commands from the latest snapshot.
Double-entry ledger where every fill produces balanced debit and credit entries, with an invariant that the sum is always zero.
Reconciliation job that compares the internal ledger with a simulated external broker or custodian statement and surfaces "breaks" with a resolution workflow.
Circuit breaker per symbol, implemented as a state machine (closed, open, half-open) driven by rolling volatility.
Sharded scale-out over Kafka (partitioned by symbol for matching, by account for risk) with honest, hypothesis-driven benchmarks.
CQRS read side: dashboards and APIs read from projections, never from the matching engine.

3. The Application
3.1 Actors
Actor
What they do
Trader
Places, amends and cancels orders. Views positions, P&L and order status.
Risk officer
Sets per-account limits. Views rejections and breaker state. Can manually halt a symbol.
Operations analyst
Uploads external statements, reviews reconciliation breaks and resolves them.
Admin
Manages users, accounts and instruments.
Market simulator (internal)
Generates realistic order flow for demos and load tests.

3.2 What the user sees
Trading screen: live order book (top N levels), recent trades, order entry form, open orders.
Portfolio screen: positions, available vs held cash, realized/unrealized P&L.
Risk console: limits, rejections with reasons, circuit breaker state per symbol.
Operations screen: reconciliation runs, breaks list, resolution actions.
Audit view: the event history of any order, with the account snapshot used for each decision.
The full page list, tiers and contents are in 3.4. The API behind them is in 5.10.
3.3 What is deliberately out of scope
Real market data feeds, real brokers, real money, regulatory reporting formats, multi-currency, derivatives. This is a simulation of the hard parts, not a product.
3.4 Frontend pages: what to build and what a company wants to see
Principle. In an interview, the person opening your demo gives it about three minutes. The UI is not the product, it is the evidence for your backend claims. Every page below exists to make one guarantee visible (async lifecycle, reservations, audit trail, breaker, recovery, reconciliation). If a page doesn't prove something, don't build it. The 10% time cap on UI (4.1) still applies, so pages are tiered.
Page inventory
#
Page
Route
Role
What it proves
Tier
P0
Home and auth
/ (also /login and /signup; same page scrolled to auth)
public
Hero, how-it-works steps, authentication, and demo access
1
P2
Trading screen
/trade/:symbol
TRADER; ADMIN read-only
Price-time priority, async order lifecycle, reservation, breaker state
1
P3
Portfolio
/portfolio
TRADER; ADMIN, RISK, OPS read-only
Reservation model, double-entry ledger, available vs held cash
1
P4
Order detail and audit trail
/orders/:id
TRADER (own), RISK, OPS, ADMIN
Event sourcing, every rejection is an event with its account snapshot
1
P5
Risk console
/risk
RISK; ADMIN read-only
Breaker state machine, halt policy, rejections feed
2
P6
Reconciliation
/ops/recon, /ops/recon/breaks/:id
OPS; ADMIN read-only
Back-office correctness, break workflow, idempotent re-upload
2
P7
System / proof dashboard
/system
ADMIN
Measured performance, fencing, invariants, crash recovery
2
P8
Admin
/admin
ADMIN
Instruments, accounts, funding (can be minimal tables or seed scripts)
3
P9
Assistant
/assistant
TRADER
Permission-aware tool calling (only if the 8.3 stretch is built)
3

Role gating. "Read-only" means the page loads and its GET calls succeed, but every write control (order entry, cancel, halt, resume, limit edits, break resolution) is disabled or hidden, and the server rejects the writes anyway (5.10). ADMIN is read-only on P2 to P6, and P7 and P8 are ADMIN-only. P9 (assistant) is TRADER-only, because it acts within the logged-in user's own permissions. On P3, RISK, OPS and ADMIN pick an account first, because the account endpoints take an {id}. Derive the frontend route guards from this Role column and the endpoint tables in 5.10, and keep them in one shared place (the common package) so the two cannot drift. Build tier 1 first (these four pages cover roughly 60% of UI time and carry most of the story), then tier 2, and treat tier 3 as optional.
What each page contains
P0 Home and auth. A public home page with a hero, four “how it works” steps, and an auth panel. `/`, `/login`, and `/signup` render this page; the latter two scroll to the auth panel. The panel has Sign in and Create account tabs, plus in the demo profile four one-click buttons: Continue as Trader / Risk officer / Ops analyst / Admin (seeded users). Nav items are shown by role, but the server enforces every permission (hiding a menu item is not security).
P2 Trading screen.
Symbol picker with a breaker badge per symbol (Closed, Open, Half-open).
Order book ladder: top 10 levels per side, quantity and cumulative depth bars, spread, last trade price.
Recent trades tape.
Order entry: side, type (limit, market), time in force (GTC, IOC), price, quantity. Inline validation for tick and lot size. Show an estimated reservation (priceCap x quantity, labelled as an estimate) and the cash that would remain available.
Open orders table: status, filled/total, remaining, cancel button.
Order lifecycle strip after submit: Received (202) -> Accepted -> Resting / Partially filled -> Filled or Rejected (reason). Never show "success" on a 202; it only means durably received (5.6).
Banner when the symbol is Open or Half-open, with the halt reason and an incident timer against maxHaltDuration.
Connection indicator, with a "conflated" badge when the slow-client policy kicked in.
P3 Portfolio.
Cash card: total, held, available.
Held-by-symbol table with the reason (resting order, symbol halted).
Positions: quantity, average cost, mark price, unrealized and realized P&L.
Reservations list per order (placed, converted, released amounts).
Ledger entries view (debit and credit lines per fill) as a tier-2 add-on.
P4 Order detail and audit trail. The cheapest high-value page in the project.
Timeline of every event for the order: journal sequence number, timestamp, event type (OrderSubmitted, OrderAccepted, ReservationPlaced, TradeExecuted, OrderCancelled...), payload.
Reservation movements alongside the fills, including price improvement released.
For a rejection: the reason and the account snapshot used for the decision (available cash at that moment vs required). This is what makes "every rejection is an event" visible.
A one-line plain-English explanation ("Rejected: needed 10,125.00, available 9,800.00").
P5 Risk console.
Per-account limits table (editable).
Live rejections feed with filters (reason, account, symbol).
Breaker table: symbol, state, trip reason (measured volatility vs threshold), time in state, incident clock as a progress bar against maxHaltDuration, resting order count, funds held.
Manual halt and resume with a mandatory reason. Force-cancel (halt_timeout) events are visible in the feed.
P6 Reconciliation.
Upload box for the external statement CSV. Re-uploading the same file shows "already processed, no new breaks".
Runs list with counts per break type.
Breaks table: type, trade id, internal vs external quantity and price, age, status.
Break detail: side-by-side internal vs external record, resolve form (status, mandatory reason, optional ledger adjustment preview), audit trail of every status change.
P7 System / proof dashboard. The page that separates this from a typical student project.
Live throughput, p50/p95/p99 latency, queue depth, consumer lag, event-loop lag (charts fed by prom-client, with a link out to Grafana).
Shard table: owner instance, fencing epoch, last journal sequence, last snapshot sequence, last recovery time.
Invariants panel with green/red checks: ledger debits equal credits, positions sum to zero per symbol, no negative available cash, replay equals live. Each has a "run now" button.
Demo-profile controls (disabled outside the demo profile): start/stop the market simulator at a chosen rate, kill a shard, freeze a shard (the zombie test, R7), verify replay, reset demo data.
P8 Admin. Instruments (tick size, lot size, protection band, reference price), accounts with a funding action (creates a ledger entry), users and roles. Plain tables are enough.
P9 Assistant (stretch). A chat box where the assistant answers questions about the user's own positions and orders through tool calls. Show the tool calls and the audit entry each one created.
What each company is likely to want to see
Treat these as angles drawn from public postings, not facts about internal teams (see the honesty note).
Angle
Pages to lead with
The sentence the demo should support
UBS (reliability, audit, governed AI)
P4, P7, P9 if built
"Every decision is an event I can replay, and the system recovers exactly after a crash."
Morgan Stanley (concurrency, scale, resilience)
P2, P7
"One writer per symbol, no locks; here is the latency under load, and here is a shard being killed and recovering."
Apollo (trade processing, reconciliation)
P6, P3 (ledger view)
"Books from two systems disagree; here is how breaks are detected, worked and audited."
ZS (SQL, data modeling)
P3, P6, P4
"Filterable, data-heavy views backed by a clean ledger and projection schema."

The 3-minute demo script
Trader: simulator is running, watch the book move. Place an order and watch it go Received -> Accepted -> Filled.
Reject path: place an order above available cash. It returns 202, then a rejection arrives. Open P4 and show the account snapshot behind the decision.
Risk officer: manually halt a symbol (or let the simulator trip the breaker). Show the incident clock, then cancel a resting order as the trader and watch held funds drop.
System: kill a shard mid-flow. Show recovery time, then the invariants panel staying green.
Ops: upload a statement containing seeded breaks, resolve one with a reason, show the audit trail.
Record this as the 2 to 3 minute video (13.3).
UI rules
Dense tables beat pretty design. Use one component library or plain CSS. No custom design system.
Data fetching: React Router, TanStack Query for REST, and a single useSocket hook for WebSocket. No Redux. Pin exact versions and commit package-lock.json (4.3, 4.4).
Money: the API sends decimal strings. The UI formats them and never does balance arithmetic with floating-point numbers. Anything the UI computes (the reservation estimate) is labelled an estimate.
Live data: treat the WebSocket as snapshot plus deltas. Every delta carries a seq; on a gap, refetch the REST snapshot (5.10). Reconnect with backoff and show a stale-data indicator.
Async honesty: every action that returns 202 shows a pending state until the outcome event arrives.
Never blank: seed data so the first load is not empty, and give admins a "reset demo" button.
Time-box: tier 1 in about one week of UI work, tier 2 in the next. Stop when the demo script above works end to end.

4. Technologies and Tech Stack
4.1 Stack
Layer
Technology
Why
Language
TypeScript 6.0 (strict) on Node.js 24 LTS
One language for engine, API and UI, with shared types and validation schemas. Exact versions in 4.3.
Runtime model
One single-threaded event loop per shard process, with a synchronous deterministic engine
The event loop is a natural single writer. Parallelism comes from more processes (one per Kafka partition), not threads.
API framework
Fastify 5
Lean, fast, plugin model. Used for the HTTP and WebSocket edge, not for the matching core.
Matching core
Plain TypeScript package, zero runtime dependencies, no async
Keeps the engine deterministic, fast and unit-testable. Shows you understand where a framework helps and where it hurts.
Messaging
Apache Kafka 4.2 via @confluentinc/kafka-javascript
Partitioned log, ordering per key, replay, transactions. KafkaJS is not used (4.5, item 5).
Journal / DB
PostgreSQL 18 via pg, explicit SQL, no ORM
Event journal (v1), ledger, projections, reconciliation data. Append-only tables want explicit SQL and batch inserts.
Cache
Redis 8 or Valkey 9
Hot read models (top of book, positions), rate limiting.
Real-time
WebSocket (ws, via @fastify/websocket)
Market data and order updates to clients.
Security
JWT verified with jose, role checks in Fastify hooks
Needed for risk officer / trader / ops separation.
Frontend
React 19 + TypeScript + Vite 8, React Router 7, TanStack Query 5
Dashboards only. Do not spend more than ~10% of total time here.
Observability
prom-client, Prometheus, Grafana, Fastify's built-in pino logging (stretch: OpenTelemetry)
You need metrics to prove your scaling claims, including event-loop lag.
Testing
Vitest 4, fast-check 4, ESLint 10 purity rules, Testcontainers for Node
Property-based tests for matching and ledger invariants. Lint rules enforce the purity of engine-core.
Benchmarking
tinybench (micro), node --cpu-prof (profiling), k6 (HTTP), custom Kafka producer (order flow)
Microbenchmarks plus end-to-end load.
Packaging / CI
Docker, docker-compose, GitHub Actions
Deployment is mandatory per your senior's advice.
Deployment
A small cloud VM or container host
Live demo link on your resume.

4.2 Technology rules (so you don't over-engineer)
Money and quantities are bigint (ticks and lots). Never number for money. Convert to decimal strings only at the API edge (4.5, item 6).
No Kubernetes unless everything else is finished. docker-compose with multiple shard containers is enough to demonstrate sharding.
No microservices for their own sake. Start as a modular monorepo with clean package boundaries, then split along the real boundaries (risk stage, shard, read side).
No ORM, no heavyweight framework in the core. engine-core imports nothing.
Ask for each technology: "What problem in this project does it solve?" If you can't answer, remove it.
4.3 Pinned version matrix (checked 1 October 2026)
Status column: checked means I confirmed it from release pages or package listings while researching this edition. verify means I did not confirm a current version, so run the Day-1 check (4.6) and pin the result. For any package, npm view <package> version peerDependencies shows the current version and what it requires.
Component
Pin
Status
Notes
Node.js
24 LTS (24.x latest patch)
checked
Node 24 is the active LTS. Node 26 becomes LTS on 28 Oct 2026, but the Confluent Kafka client's prebuilt binaries only list Node up to 24, so stay on 24 (4.5, item 3). Put it in .nvmrc and engines.
npm
the npm that ships with Node 24 (11.x)
checked
Use npm workspaces. Confluent's client documents pnpm and yarn support as experimental (4.5, item 4).
TypeScript
6.0.x
checked
TypeScript 7.0 (native Go compiler) is stable, but typescript-eslint does not support it yet (peer range below 6.1), so stay on 6.0.x (4.5, item 1). Optionally run tsgo --noEmit as an extra fast check.
ESLint
10.x
checked
Plugins must declare ESLint 10 support (4.5, item 2). Keep the plugin list short.
typescript-eslint
8.6x (latest 8.x)
checked
Peer range requires TypeScript below 6.1.
Vitest
4.1.x
checked
@vitest/coverage-v8 on the same version.
fast-check
4.7.x (latest 4.x)
checked
With @fast-check/vitest (0.2.3 or later for Vitest 4). Check the license in the repo before adopting.
Fastify
5.10.x
checked
Pin the exact version. Plugins must declare Fastify 5 support.
@fastify/websocket
the major that supports Fastify 5
verify
Or use ws directly.
@confluentinc/kafka-javascript
1.10.x
checked
Wraps librdkafka. Prebuilt binaries for Node 24 on Debian Bookworm and Alpine 3.20+. Config uses librdkafka property names; KafkaJS-style options go in a kafkaJS block.
Kafka broker
Apache Kafka 4.2.2 (apache/kafka:4.2.2)
checked
KRaft only (no ZooKeeper). If that tag isn't published, use 4.2.1. Stay on 4.2.x.
PostgreSQL
18.x (postgres:18)
checked
Stay on 18 for the whole project.
pg (node-postgres)
latest 8.x
verify
Configure int8 parsing to bigint (4.5, item 6).
SQL migrations
node-pg-migrate, or plain numbered .sql files with a small runner
verify
Pick one.
Redis
8.x (redis:8) or Valkey 9.x (valkey/valkey:9)
checked (verify exact tags)
Pick one and don't mix. Both speak RESP, so one Node client works for either. Redis 8 is offered under RSALv2, SSPLv1 or AGPLv3; Valkey is BSD-3.
Redis client
redis (node-redis) or ioredis
verify
Pick one. Clients accept strings, so encode bigint as strings.
jose
latest
verify
JWT verification and signing.
zod
latest 4.x
verify
Shared validation schemas in common, used by API and UI.
prom-client
latest
verify
Metrics, including event-loop lag.
tinybench
latest
verify
Micro-benchmarks in the benchmarks package.
Testcontainers (Node)
latest, plus @testcontainers/postgresql and @testcontainers/kafka
verify
Fallback: docker-compose services in CI.
React
19.2.x
checked


React Router
7.x (react-router-dom 7.15 seen)
checked


TanStack Query
5.x
checked


Vite
8.x (Rolldown-based) with @vitejs/plugin-react 6.x
checked
Vite 8 needs Node 20.19+ or 22.12+, so Node 24 is fine.
Prometheus
v3.x, pin an exact tag
verify


Grafana
13.1.x, pin an exact tag
verify
Check the tag exists before pinning.
k6
pin one major: v1.7.x (checked), or v2.x (verify)
checked / verify
Scripts may need small changes between majors.
Docker
current stable Engine + Compose v2
checked
No version: key in compose files. Never use latest tags. App image: node:24-bookworm-slim (verify the tag).
CI
GitHub Actions with actions/setup-node set to Node 24 and npm ci
checked
Same Node as local.

4.4 Dependency rules (so versions never fight)
Lockfile is law. Commit package-lock.json, install with npm ci in CI and Docker, and save exact versions (--save-exact, or save-exact=true in .npmrc).
Pin the runtime. .nvmrc and "engines": { "node": ">=24 <25" } in the root package.json, and the same Node major in the Dockerfile and CI.
Pin the toolchain as a set. TypeScript, ESLint, typescript-eslint, Vitest and Vite move together. Upgrade them in one dedicated commit, after checking each one's peer ranges with npm view.
Ignore automatic major bumps of TypeScript, ESLint and the Kafka client until you have read the peer ranges (4.5, items 1 and 2). If you use Dependabot or Renovate, configure ignore rules for those majors.
There are twelve backend packages plus the web/ app in one npm workspaces monorepo. The circuit breaker is a folder inside engine-core (engine-core/src/breaker), not a package. The new `packages/system-tests` workspace exists only for cross-package wiring tests without creating a forbidden dependency edge, so it may import the engine and the backend packages, including `@matchledger/recon`, but no package may import it. Pure-zones in `packages/risk/src/core/**`, `packages/ledger/src/ledger.ts`, `packages/recon/src/core/**`, and `packages/projections/src/order-facts.ts` and `mappers.ts` are linted separately: they may import type-only `@matchledger/common`, they may not import `node:*`, and they cannot use `Date`, `Math.random`, `await`, `Promise`, `setTimeout`, or any other forbidden runtime API. Respect the dependency map below:
Package
May depend on
Must not depend on
engine-core (includes breaker/)
nothing at runtime (dev: Vitest, fast-check)
Any node:* import, any npm runtime dependency, async/await/Promises, clock, random or I/O APIs
common
engine-core types, zod
node:* imports (it must stay browser-safe because web imports it)
journal
engine-core, common, pg
web, Kafka
shard
engine-core, common (journal and the Kafka client are later-stage dependencies)
api, web
risk
common only for Week 4; journal and the Kafka client are later-stage dependencies; in the Week 6 work it remains pure and the core logic is in risk/src/core
web
ledger
common only in the Week 6 work; no journal import in the pure ledger zone
web, Kafka
system-tests
engine-core, common, shard, risk, ledger, journal, recon
nothing; it is test-only wiring and may not be imported by the production packages
projections
common, pg, the Redis client, the Kafka client
engine-core internals
api
common, journal, projections, risk and recon client interfaces, Fastify, @fastify/websocket, jose, prom-client
shard internals
simulator
common, the Kafka client
api internals
benchmarks
engine-core, common, shard, risk, tinybench
Fastify, @fastify/*, Kafka, pg, redis. The broader dependency set is a Week 4
deviation so the end-to-end harness can use the real runner and risk code.
web
common (browser-safe)
everything else in the backend

Enforce it mechanically. A CI script reads each package.json and fails if a package depends on anything outside its allowed list (engine-core must have an empty dependencies object). ESLint's no-restricted-imports and no-restricted-syntax enforce the rest (snippet in 4.7).
No latest image tags anywhere, and no unpinned Node in CI.
Snapshot the result: commit docs/versions.md with your final table and the output of npm ls --all (trimmed to top-level if it is huge).
4.5 Known conflict traps and how this plan avoids them
TypeScript 7 vs typescript-eslint. TypeScript 7.0 (the native compiler) is stable, but it ships without a stable programmatic API until 7.1, and typescript-eslint declares a peer range that excludes it and closed a day-one support request as not planned. Forcing TypeScript 7 breaks the linter. Pin TypeScript 6.0.x. You can still use tsgo --noEmit for a fast type check on the side. Revisit when TypeScript 7.1 and a typescript-eslint release land.
ESLint 10 plugin compatibility. ESLint 10 removed some old rule-context methods (for example context.getFilename()), which breaks plugins that haven't updated. Before adding any ESLint plugin, check its peer range. Prefer built-in rules for the purity checks (4.7).
Node 26 vs the Kafka client. Node 26 becomes LTS in late October 2026, but the Confluent client's prebuilt binaries are listed only up to Node 24 (and support is dropped after a Node version's end of life). Without a prebuilt binary, npm install needs a C++20 compiler and Python. Stay on Node 24.
Package manager. Confluent documents pnpm and yarn support for its client as experimental, so this plan uses npm workspaces.
KafkaJS is not used. It has had no new release in about three years. @confluentinc/kafka-javascript is the maintained client, with a KafkaJS-compatible API, a transactional producer, and cooperative-sticky assignment. When you follow old KafkaJS tutorials, adapt: librdkafka properties go at the top level, KafkaJS-style options go in a kafkaJS block, and acks/compression are set when you create the producer, not per send().
bigint everywhere money touches a boundary. JSON.stringify throws on bigint, pg returns int8 as a string unless you configure a parser, and Redis clients accept only strings. Write one money codec in common (bigint <-> decimal string, with bounds checks), use it at every boundary (API, Postgres, Redis, Kafka payloads), and test the round trip (property P10).
Plain objects reorder integer-like keys. Never use {} as a price-level map. Use Map, which keeps insertion order and takes bigint keys.
await is Node's race condition. Two handlers that each await between a read and a write can interleave. The engine is synchronous (no await, enforced by lint), and every I/O stage handles messages for one partition strictly one after another (an awaited loop, never Promise.all over messages).
Event-loop stalls look like dead consumers. A long synchronous batch or a GC pause can exceed the Kafka session timeout, causing a rebalance while the old process is still running. That is a real zombie scenario, and it is why fencing (5.7) is needed. Cap batch sizes, yield to the event loop between batches (outside engine-core), and export event-loop lag as a metric.
Consumer protocol. Cooperative-sticky assignment and static membership (5.7) are group.protocol=classic features. The newer consumer protocol (KIP-848) assigns partitions on the broker. Set group.protocol=classic explicitly and confirm against the librdkafka version bundled with your client. Fencing is the safety mechanism under either protocol.
Kafka 4.x is KRaft only. Any compose file with a zookeeper: service is obsolete. On a single broker, transactions hang unless transaction.state.log.replication.factor=1 and transaction.state.log.min.isr=1 are set (included in 4.7).
Vite 8 and Vitest 4 tutorials. Vite 8 is Rolldown-based with @vitejs/plugin-react 6, and Vitest 4 changed some mocking behavior. Older tutorials may not match.
Redis vs Valkey. Pick one for the whole project and confirm it in Day-1 spike 6.
Floating versions. Unpinned tags, unpinned Node, and automatic major upgrades are the most common cause of "it worked yesterday". Pin everything.
4.6 Day-1 verification checklist (Week 1, about 1 to 2 days)
Do all of these before writing real code. Every box should be green.
[ ] node -v shows 24.x and npm -v shows 11.x, matching .nvmrc, engines and CI
[ ] npm ci succeeds from a clean checkout, and tsc -b builds all workspaces
[ ] npm view checked for every verify row in 4.3, and the results recorded in docs/versions.md
[ ] docker compose up starts Postgres 18, Redis (or Valkey), Kafka 4.2.x, Prometheus and Grafana at your pinned tags (every tag pulls successfully)
[ ] import('@confluentinc/kafka-javascript') loads on your OS and Node 24 with no compilation (prebuilt binary found)
[ ] Spike 1: a tinybench hello benchmark runs in benchmarks
[ ] Spike 2: the ESLint purity rules in 4.7 pass on engine-core/src, then fail when you add Date.now(), Math.random(), an await, or a node:fs import to it. Test files and the simulator are not covered by the rule.
[ ] Spike 3: an integration test starts Postgres and Kafka through Testcontainers (or compose services in CI)
[ ] Spike 4: a Kafka transactional producer (transactionalId set) and a read_committed consumer round-trip on the single-broker compose. Also check: (a) a consume-process-produce transaction that commits offsets (sendOffsets), and (b) starting a second producer with the same transactionalId fences the first
[ ] Spike 5: a Fastify route with a JWT check (jose) and a WebSocket echo (ws) work
[ ] Spike 6: the Redis client does set/get, with a bigint stored and read back as a string through the money codec
[ ] Spike 7: a bigint round-trips through Postgres (int8 parsed to bigint), JSON (as a decimal string) and Redis
[ ] docs/versions.md committed with your final table
4.7 Reference snippets
Root package.json (excerpt):
{
  "name": "matchledger",
  "private": true,
  "engines": { "node": ">=24 <25" },
  "workspaces": [
    "packages/engine-core", "packages/common", "packages/journal",
    "packages/shard", "packages/risk", "packages/ledger", "packages/recon",
    "packages/projections", "packages/api", "packages/simulator",
    "packages/benchmarks", "web"
  ],
  "scripts": {
    "build": "tsc -b",
    "lint": "eslint .",
    "test": "vitest run",
    "check:boundaries": "node scripts/check-boundaries.mjs"
  }
}

tsconfig.base.json (excerpt):
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "composite": true,
    "declaration": true
  }
}

TypeScript 6 changed some defaults and removed old options, so generate the config with the TypeScript 6 compiler (tsc --init) and compare it with this excerpt instead of copying blindly. Check each option against the TypeScript 6 release notes.
ESLint purity rules for engine-core (flat config excerpt, ESLint 10). The Day-1 spike proves they fire. Check the exact no-restricted-imports pattern semantics against the ESLint 10 docs.
// eslint.config.js (excerpt)
export default [
  // ... shared config ...
  {
    files: ["packages/engine-core/src/**/*.ts"],
    rules: {
      "no-restricted-globals": ["error",
        { name: "Date", message: "Time is an input (5.8)" },
        { name: "performance", message: "No clock in the engine" },
        { name: "process", message: "No environment access in the engine" },
        { name: "setTimeout" }, { name: "setInterval" },
        { name: "setImmediate" }, { name: "queueMicrotask" },
        { name: "crypto" }, { name: "fetch" }
      ],
      "no-restricted-properties": ["error",
        { object: "Math", property: "random", message: "No randomness in the engine" },
        { object: "Date", property: "now" },
        { object: "performance", property: "now" }
      ],
      "no-restricted-syntax": ["error",
        { selector: "AwaitExpression", message: "engine-core is synchronous" },
        { selector: "FunctionDeclaration[async=true], FunctionExpression[async=true], ArrowFunctionExpression[async=true]",
          message: "engine-core is synchronous" },
        { selector: "NewExpression[callee.name='Promise']", message: "engine-core is synchronous" }
      ],
      "no-restricted-imports": ["error", {
        patterns: [{ regex: "^(node:|[^./])", message: "engine-core imports only its own files" }]
      }]
    }
  }
];

Using bigint and Map is fine. If you need another banned API (for example Intl.DateTimeFormat or structuredClone for hidden cost), add it to the list.
docker-compose.yml (no version: key; adjust tags to what you verified on Day 1). Two Kafka listeners so the app works both inside Docker and when you run Node on your host:
services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: matchledger
    ports: ["5432:5432"]
  redis:
    image: redis:8
    ports: ["6379:6379"]
  kafka:
    image: apache/kafka:4.2.2        # fall back to 4.2.1 if this tag isn't published
    ports: ["29092:29092"]
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: INTERNAL://:9092,EXTERNAL://:29092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka:9092,EXTERNAL://localhost:29092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1   # required for transactions on one broker
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1              # required for transactions on one broker
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
  prometheus:
    image: prom/prometheus:v3.11.2   # pin an exact v3.x tag you have pulled
  grafana:
    image: grafana/grafana:13.1.3    # verify the tag exists; pin an exact 13.1.x

Containers talk to Kafka at kafka:9092; the app on your host uses localhost:29092.
Kafka client settings (librdkafka property names, consistent with 5.6 and 5.7):
Setting
Value
Why
enable.idempotence / acks (producers)
true / all
Durable, deduplicated publishes
transactional.id (shard and risk producers)
stable per owned partition, for example matchledger-risk-<partition>
Producer-epoch fencing (5.7)
isolation.level (consumers)
read_committed
Never read a zombie's aborted output
enable.auto.commit
false
Offsets committed inside the transaction
group.protocol
classic
Required for client-side assignors (4.5, item 10)
partition.assignment.strategy
cooperative-sticky
Fewer ownership changes (5.7, layer 1)
group.instance.id
stable per instance
Static membership, fewer rebalances on restart
session.timeout.ms / max.poll.interval.ms
larger than your worst-case batch and GC pause
Avoid false "dead consumer" evictions (4.5, item 9)

Dockerfile sketch (build with npm ci, run compiled JavaScript):
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
RUN npm ci && npx tsc -b

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
CMD ["node", "packages/api/dist/main.js"]

Adjust paths to your layout. Use Debian (bookworm-slim), which the Confluent client lists as supported with prebuilt binaries.

5. Architecture
5.1 High-level diagram
flowchart LR
    subgraph Clients
        UI[React Dashboard]
        SIM[Market Simulator]
    end

    subgraph API["API Layer (Fastify)"]
        GW[REST + WebSocket Gateway<br/>Auth, validation, idempotency key]
    end

    subgraph RiskStage["Risk Stage (Node workers, partitioned by accountId)"]
        R1[Risk Worker 1]
        R2[Risk Worker 2]
        RES[(Reservations<br/>and balances)]
    end

    subgraph Matching["Shard Processes (partitioned by symbol)"]
        M1[Shard A<br/>one event loop, sync engine]
        M2[Shard B<br/>one event loop, sync engine]
        BR[Circuit Breaker<br/>state machine per symbol]
    end

    subgraph Log["Event Log"]
        K0{{Kafka: orders.submitted<br/>key = accountId}}
        K1{{Kafka: orders.accepted<br/>key = symbol}}
        K2{{Kafka: engine.events<br/>key = symbol}}
        K3{{Kafka: account.events<br/>key = accountId}}
        J[(Journal + Snapshots<br/>PostgreSQL)]
    end

    subgraph Read["Read Side (CQRS)"]
        P[Projections:<br/>positions, P&L, order status, book view]
        RD[(Redis)]
        PG[(PostgreSQL read models)]
    end

    subgraph Ops["Back Office"]
        LED[Double-entry Ledger]
        REC[Reconciliation Job]
        EXT[/External statement<br/>CSV from simulated broker/]
    end

    UI --> GW
    SIM --> GW
    GW -->|"durable publish (acks=all)<br/>then 202 Accepted"| K0
    K0 --> R1
    K0 --> R2
    R1 <--> RES
    R2 <--> RES
    R1 --> K1
    R2 --> K1
    K1 --> M1
    K1 --> M2
    M1 --- BR
    M2 --- BR
    M1 --> K2
    M2 --> K2
    K2 --> K3
    K3 --> R1
    K3 --> R2
    K2 --> J
    K2 --> P
    K2 --> LED
    P --> RD
    P --> PG
    PG --> GW
    RD --> GW
    GW -- WebSocket fan-out --> UI
    EXT --> REC
    LED --> REC

5.2 Order lifecycle (sequence)
sequenceDiagram
    participant C as Client
    participant G as API Gateway
    participant K as Kafka orders.submitted (key = accountId)
    participant R as Risk Stage (account partition)
    participant M as Shard (symbol partition)
    participant L as Ledger / Projections

    C->>G: POST /orders (clientOrderId, symbol, side, qty, price)
    G->>G: Authenticate, validate, dedupe on (accountId, clientOrderId)
    G->>K: Publish OrderSubmitted (acks=all, idempotent producer)
    K-->>G: Durably stored
    G-->>C: 202 Accepted + orderId (durably received, not yet accepted)
    K->>R: OrderSubmitted
    R->>R: Dedupe again, check available balance / position, place reservation
    alt Check fails
        R-->>L: OrderRejected (reason + account snapshot)
        L-->>C: WebSocket update: rejected (also readable via GET /orders/id)
    else Check passes
        R->>M: OrderAccepted (reservation id and priceCap attached)
        M->>M: Breaker check, match against book (price-time priority)
        M-->>L: Fill / PartialFill / Rested / Cancelled events
        L->>R: Convert or release reservation
        L-->>C: WebSocket order update
    end

5.3 Components in detail
Matching core (engine-core package, plain TypeScript)
Order book per symbol: two sides (bids and asks). Each side is a set of price levels, each level a FIFO queue of orders.
JavaScript has no built-in sorted map, so build one from simple parts: a Map<bigint, PriceLevel> for lookup, plus a sorted array of active prices kept ordered by binary search so the best price is the last element (O(1) to read or remove). Bids and asks use opposite orderings.
PriceLevel holds a doubly linked list of order nodes. A Map<OrderId, OrderNode> makes a cancel an O(1) lookup and O(1) unlink instead of scanning a queue.
Complexity to state in an interview: best price O(1); adding to an existing level O(1); a new price level costs O(log n) to find plus O(n) to shift the array (fast in practice because n, the number of live levels, is small); cancel O(1). If profiling shows level insertion is hot, replace the array with a balanced tree or skip list (stretch).
Use Map, never a plain object, for any map keyed by price (4.5, item 7).
Order types: limit, IOC (immediate-or-cancel). Stretch: FOK, stop. A market order never reaches the matcher uncapped: the risk stage converts it into an IOC order with a hard price cap (5.9).
Matching rule: price-time priority. Incoming aggressive order matches the best opposite price first, then earliest order at that price. Trade price = resting order's price.
Single writer: each symbol is owned by exactly one shard process, and inside it the engine is synchronous. Input is a bounded queue of commands, output is a list of events. Conceptually the engine is a function from (state, command) to (state, events); for speed the state is mutated in place, and determinism (same state plus same command gives the same events) is the contract that makes replay trivial.
Determinism rule: the engine must not read the clock, random numbers, the environment or any I/O. Time is an input: every command carries a ts stamped by the shard's input stage and journaled before the engine sees it, and a Tick(ts) command drives every time-based rule (5.8). Ids are passed in too, so replays produce identical results. Enforce this mechanically with the ESLint rules in 4.7 (no Date, Math.random, performance, timers, process, node:* imports, await or Promises in engine-core/src).
No hidden iteration order: use Map (insertion ordered) and sorted arrays, never plain-object key order.
Risk stage (risk package)
Orders arrive from the durable orders.submitted topic (keyed by accountId, see 5.6), so each account is consumed by exactly one risk worker, with ownership enforced by fencing (5.7).
Serialization rule (Node-specific): messages for one partition are handled strictly one after another in an awaited loop. Never run several handlers for the same account concurrently (no Promise.all over messages), or two orders can pass the same balance check across an await.
Reservation model:
Buy: reserve priceCap x quantity. priceCap is the order's limit price or, for a market order, the protection cap computed in 5.9. The same priceCap is attached to OrderAccepted and enforced by the matcher as a hard limit, so the reservation is always a true upper bound on what the order can cost.
Sell: reserve the shares.
On fill: convert the reservation proportionally into settled cash and position. Release any price-improvement difference.
On cancel, reject by matcher, expiry or IOC remainder: release the remaining reservation.
Invariant: availableCash = totalCash - heldCash >= 0 at all times, and availableShares >= 0 for every symbol.
Account events (fills, cancels) flow back from the matcher to the account's partition, keeping account state single-writer.
Shard runner (shard package)
This is the impure code around the pure engine, kept in its own package so engine-core stays free of I/O:
the input stage: dequeues commands, stamps ts, journals them, injects Ticks (5.8)
Kafka consume/produce with transactions, the fencing lease and revoke handling (5.7)
snapshot scheduling and recovery
batch limits and yielding to the event loop, so the process keeps heartbeating (4.5, item 9)
crash policy: on a fencing failure, an unhandled rejection or an uncaught exception, exit the process and let the supervisor restart it (fail-stop). On SIGTERM, stop consuming, flush the journal, release the lease, then exit.
Event log and recovery
Events are immutable facts, named in the past tense: OrderSubmitted, OrderAccepted, OrderRejected, OrderRested, TradeExecuted, OrderCancelled, ReservationPlaced, ReservationReleased, BreakerTripped, BreakerHalfOpened, BreakerClosed.
v1 journal: append-only table in PostgreSQL. Each record is either a stamped command (including Ticks) or an event, with a per-stream monotonically increasing sequence number and the writer's fencing epoch (5.7). (stream_id, seq) is the primary key. Batch writes (one multi-row insert per batch) for throughput. Money fields are stored as BIGINT and parsed back to bigint.
v2 log: Kafka topics partitioned by symbol (matching) and account (risk). Journal remains the durable record for snapshots and audit.
Snapshots: every N events (for example 10,000) or T seconds, persist book state plus the last applied sequence number.
Recovery: load latest snapshot, then re-execute the journaled stamped commands (including Ticks) with a higher sequence number through the deterministic engine, and resume. The regenerated events must equal the stored events (test P7). Measure and report recovery time.
Idempotency has two boundaries: the gateway dedupes on (accountId, clientOrderId) before publishing (so a client retry after a gateway crash gets the original order back), and the risk stage dedupes again on consume (so Kafka redelivery is harmless). Downstream consumers deduplicate by event id or sequence.
Ledger (ledger package)
Double-entry: every economic event creates entries that sum to zero (for example a fill debits buyer cash, credits seller cash, credits buyer position, debits seller position).
Append-only. Corrections are new reversing entries, never edits.
Invariants checked continuously (and in tests): total debits equal total credits, no negative cash beyond configured margin (none in v1), positions sum to zero across all accounts per symbol (every share bought was sold).
Reconciliation (recon package)
Input: a CSV from a simulated external broker/custodian containing their view of trades and positions.
Process: match internal fills to external records by trade id, then compare quantity, price and settlement date.
Break types: missing internal, missing external, quantity mismatch, price mismatch, duplicate, late.
Workflow: each break gets a status (open, investigating, resolved, written off) with a mandatory reason and an audit entry. Resolution that changes books produces a ledger adjustment event.
Parse CSV as a stream (not readFile into memory), so a huge file doesn't stall the event loop.
Circuit breaker (folder engine-core/src/breaker, per symbol)
The breaker is a folder inside engine-core, not a package, because it runs synchronously inside the single-writer loop and must obey the same purity rules as the rest of the engine (no clock, random or I/O). A separate package would imply a dependency boundary that doesn't fit that requirement.
State machine:
stateDiagram-v2
    [*] --> Closed
    Closed --> Open: volatility or deviation exceeds threshold
    Open --> HalfOpen: cooldown elapsed
    HalfOpen --> Closed: stable for T seconds with limited flow
    HalfOpen --> Open: threshold breached again

Closed: normal matching.
Open: no matching. New orders are rejected with breaker_open, and the rejection releases any reservation through the normal path. Cancels are always allowed, and each cancel releases its reservation immediately. Resting orders stay in the book.
Half-open: matching only within a price band around the last valid price, with a cap on orders per second (measured in command timestamps, see 5.8), to test whether the market has stabilized.
Trigger: rolling volatility over the last N trades (a count-based window needs no clock) or deviation from a rolling reference price. Thresholds are configurable per symbol.
Time: cooldown, per-second caps and halt timeouts are measured by comparing timestamps carried on stamped commands and Ticks (5.8). The breaker never reads the wall clock, so it replays identically.
Policy you must choose and defend: what happens to resting orders when it trips (stay, cancel, or re-price). Recommended default: leave them resting, block matching, allow cancels.
Funds held during a long halt (explicit policy). A halt leaves reservations locked against resting orders. Decision: this is an accepted, bounded limitation, handled four ways:
Early rejection: the risk stage follows breaker events from engine.events and rejects new orders for a halted symbol with symbol_halted before placing any reservation. A reservation that raced past this check is released when the matcher rejects with breaker_open.
Self-service release: a trader can cancel their own resting orders during a halt, and each cancel releases its reservation immediately.
Hard bound: an incident clock starts at the first trip (or at a manual halt by a risk officer) and runs until the breaker is fully Closed again, across any Open/Half-open flapping. If it exceeds maxHaltDuration (configurable, measured in tick time), the engine force-cancels all resting orders on that symbol with reason halt_timeout, which releases their reservations.
Visibility: the account view shows held funds per symbol with the halt reason, and affected accounts get a WebSocket notification when a halt starts and when orders are force-cancelled.
The README must state this limitation and the chosen maxHaltDuration.
Read side (CQRS)
Projections consume engine events and build: order status, positions, P&L, top-of-book, recent trades.
Redis for hot reads, PostgreSQL for history.
WebSocket fan-out with a bounded buffer per client. Check each socket's bufferedAmount before sending: slow consumers get conflation (only the latest book snapshot is kept) or are disconnected. They must never slow the engine or other clients, and a stalled client must never be allowed to grow the process's memory without bound.
5.4 Kafka topic layout
Topic
Key
Partitions
Producer
Consumers
orders.submitted
accountId
N
API gateway (idempotent producer, acks=all)
Risk stage
orders.accepted
symbol
M
Risk stage
Shard processes
engine.events
symbol
M
Shard processes
Projections, ledger, journal, risk (via account.events)
account.events
accountId
N
Router from engine.events
Risk stage
recon.breaks
breakId
1 to 3
Reconciliation job
Operations projection

Rule: in steady state one partition is owned by one consumer instance, which gives you the single-writer property per key without locks. During rebalances, restarts, event-loop stalls and process pauses Kafka alone does not guarantee this, so it is enforced mechanically by fencing (5.7).
5.5 Core data model (simplified)
accounts(id, owner, status, created_at)
instruments(symbol, tick_size, lot_size, protection_band_bps, max_band_bps,
            reference_price_ticks, max_reference_age, status)
order_requests(account_id, client_order_id, order_id, payload_hash, created_at)
            -- UNIQUE (account_id, client_order_id): gateway dedupe, detects same id + different payload
shard_leases(stream_id, owner, epoch)  -- fencing, see 5.7

journal(stream_id, seq, record_type, payload_json, ts, writer_epoch, created_at)  -- append-only
            -- record_type = COMMAND (stamped, incl. Tick) or EVENT; PK (stream_id, seq)
snapshots(stream_id, last_seq, state_blob, created_at)

ledger_entries(id, tx_id, account_id, asset, amount, direction, ref_event_id, created_at)
reservations(id, account_id, order_id, asset, amount_total, amount_remaining, status)

orders_view(order_id, account_id, symbol, side, qty, filled_qty, price, status, updated_at)
positions_view(account_id, symbol, quantity, avg_cost)

recon_runs(id, source, started_at, finished_at)
recon_breaks(id, run_id, type, internal_ref, external_ref, status, reason, resolved_by)

Money, price and quantity columns are BIGINT (ticks and lots). payload_json stores money as decimal strings, written and read only through the shared money codec (4.5, item 6).
5.6 Ingress: one topology, durable at the edge
There is exactly one path from client to risk stage: Gateway -> orders.submitted (Kafka, key = accountId) -> risk stage. (v1 equivalent: Gateway -> committed journal row of OrderSubmitted in Postgres -> in-process queue -> risk stage. Kafka replaces the in-process queue in v2; the semantics below stay the same.)
The gateway never calls the risk stage directly. It authenticates, validates, dedupes on (accountId, clientOrderId), publishes OrderSubmitted (idempotent producer, acks=all; v1: commits the journal row), and only then returns 202 Accepted with an orderId.
202 means "durably received", not "accepted" or "filled". Acceptance, rejection, fills and cancels arrive asynchronously over WebSocket and are readable via GET /orders/{id}. There is no synchronous 422 for risk failures; a rejection is an OrderRejected event the client observes.
If the gateway cannot publish, it returns 503 and never 202. No order exists in that case.
Gateway crash windows: (a) before publish: the client got no 202, retries with the same clientOrderId, normal path. (b) after publish but before the reply: the client retries, and the gateway dedupe returns the original orderId (the risk stage's second dedupe covers redelivery). No silent loss, no duplicate.
Costs to state openly: one extra durable hop of latency (report latency with and without it) and an asynchronous client contract.
5.7 Single writer as a mechanical guarantee (fencing)
Kafka assigns a partition to one consumer in a group in steady state, but that is not a safety guarantee. During a rebalance, after a long GC pause, after an event-loop stall, or after a frozen process (the session timeout fires, the partition is reassigned, the old process wakes up), two instances can both believe they own a partition. That "zombie" could break ordering, double-apply commands, or double-spend reservations. The rule is: assume the zombie will happen and make its writes fail.
Use three layers, each cheap:
Reduce churn (not safety): cooperative-sticky assignment plus static membership (group.instance.id), so routine restarts don't reshuffle ownership. This requires group.protocol=classic; with the newer consumer protocol (KIP-848) assignment is server-side and client assignors don't apply (see 4.5, item 10). This lowers the frequency of ownership changes; it does not make them safe.
Fencing epoch on every durable write (primary mechanism): table shard_leases(stream_id, owner, epoch). On gaining a partition, an instance acquires the lease with an atomic UPDATE ... SET epoch = epoch + 1 ... RETURNING epoch and remembers its epoch. Every journal append carries that epoch and succeeds only if it equals the current epoch (conditional insert), with (stream_id, seq) as a second guard. A zombie's next write fails, and on any fencing failure the instance fail-stops that stream: it exits the process (5.3, shard runner), and the supervisor restarts it through the normal path.
Fence the Kafka side: use a transactional producer with a stable transactional.id per owned partition (producer-epoch fencing: a newer producer with the same id fences the older one) and commit consumed offsets inside the same transaction, so a zombie's outputs and offset commits are rejected once a newer owner starts. Downstream consumers read with isolation.level=read_committed. Day-1 spike 4 proves the fencing behavior with your exact client version.
Also handle revocation explicitly: use the client's rebalance callback to stop the writer loop for revoked or lost partitions before releasing them, and never process buffered commands after revocation. (Check the exact rebalance hook for your client version in its docs during Spike 4.)
The same mechanism protects the risk stage (partitioned by account), which is where a zombie would double-spend.
Limits to state: the lease check adds a conditional write per batch (measure it). Fencing protects the journal and Kafka outputs, not external side effects, which is why side effects are driven off the journal and not from inside the engine.
5.8 Time is an input, never an environment read
The engine core is a function of (state, command). Anything time-based (breaker cooldown, orders-per-second cap, halt timeout, reference-price staleness) must therefore receive time as data:
Each shard has an input stage (impure, in the shard package, outside engine-core). It takes commands off the queue, stamps each with ts = max(lastTs, Date.now()) (monotonic, non-decreasing, so a backwards clock step cannot reorder time), journals the stamped command, and only then hands it to the engine.
The input stage also injects Tick(ts) commands (stamped and journaled the same way) while a time-based condition is pending (breaker not Closed, halt incident active, a reference price nearing staleness), plus a low-rate heartbeat. The engine evaluates cooldowns and timeouts only when it processes a command or tick, by comparing ts with timestamps stored in its own state.
Prefer count-based logic (rolling volatility over the last N trades, sequence numbers) wherever it gives the same answer, since it needs no clock at all.
Replay: recovery re-executes the journaled stamped commands, including ticks. The engine reads no clock, so breaker transitions and halt timeouts reproduce exactly.
Use journal sequence numbers, never ts, to order events. ts only measures elapsed time.
Trade-off to state: time-based rules have the granularity of the tick interval, and engine "time" only advances when a command or tick arrives (acceptable, because ticks are emitted whenever a timer is pending).
5.9 Market orders: reference price and bounded reservations
A buy reservation needs a worst-case price. For market orders:
The risk stage converts a market order into an IOC order with a hard priceCap. Buy: priceCap = referencePrice x (1 + bandBps / 10000), rounded to a valid tick (integer bigint arithmetic, with the rounding direction fixed and tested). Sell: a priceFloor computed the same way (a sell reserves shares, not cash).
Reference price fallback chain (computed by the risk stage from a read-only view of engine.events; it may be slightly stale):
last trade price, if its age is at most max_reference_age;
else the midpoint of best bid and best ask, if both sides exist;
else the instrument's configured reference_price_ticks (required when an instrument is listed, updated by admin or a daily-close job);
else reject with NO_REFERENCE_PRICE (only possible through misconfiguration).
Why the reservation is safe: the matcher enforces priceCap as a hard limit, so every fill price is at most priceCap, and total cost is at most priceCap x quantity no matter how the market moves between the risk check and the match. A stale reference price changes how tight the cap is, never whether the reservation is sufficient.
Empty book / first order ever: falls to step 3 of the chain. An IOC against an empty book finds no liquidity, is cancelled, and its reservation is released in full.
Trade-offs to state: a stale or static reference price after a long gap can make the cap too tight (the order can't reach fair prices) or too wide (it over-reserves). Bound the effective band with max_band_bps, and prefer the midpoint over the static price. Partial fills that stop at the cap are expected and documented.
5.10 API contract: REST and WebSocket
This section is the contract between the api package and the frontend (3.4). It follows the architecture above: commands go in asynchronously and return 202, reads come from projections (CQRS), and the gateway never talks to the engine directly (5.6).
Conventions
Base path /api/v1. JSON everywhere. Authentication with a bearer JWT verified with jose. POST /auth/login issues the token for the demo; no separate identity server.
Roles: TRADER, RISK, OPS, ADMIN. ADMIN is read-only on trading data: it may call every GET endpoint (every endpoint table below has a Role column, and ADMIN is listed on each GET it may call; the system and admin tables are ADMIN-only), but it cannot place, cancel or amend orders (only TRADER can), and it cannot halt symbols or resolve breaks (only RISK and OPS can). Trader endpoints are scoped to accounts the user owns: someone else's order or account returns 404 (don't leak existence), and a role mismatch returns 403.
Money and prices are decimal strings at the edge ("101.25"), converted to bigint ticks inside through the money codec (4.5, item 6). Quantities are integers within the safe-integer range (or strings); anything larger is rejected with 400.
Validation uses zod schemas defined once in common and shared with the UI. Validate every request body and query string at the edge.
Errors use RFC 9457 problem details (application/problem+json) with a stable code field and never a stack trace.
Async commands (place, cancel, amend, halt, resume) return 202 Accepted. The outcome arrives as an event over WebSocket and is readable by GET.
Idempotency: clientOrderId for orders (scoped per account), file hash for reconciliation uploads, requestId for funding.
Pagination: cursor style, ?limit=50&cursor=..., newest first.
Headers: X-Request-Id on every response (accept one from the client), Retry-After on 429 and 503.
Rate limiting per account on order endpoints (Redis), returning 429.
Docs: hand-write an openapi.yaml and keep it next to the code. Serving it in Swagger UI is optional (check the current @fastify/swagger-ui version and its Fastify 5 support first, and record it in docs/versions.md).
Order status values
RECEIVED -> ACCEPTED -> RESTING -> PARTIALLY_FILLED -> FILLED, plus CANCEL_REQUESTED -> CANCELLED, and the terminal REJECTED (with a reason such as insufficient_balance, symbol_halted, breaker_open, NO_REFERENCE_PRICE, halt_timeout).
Auth and identity
Method
Path
Role
Purpose
POST
/auth/login
public
Exchange credentials for a JWT (demo profile also seeds four users)
POST
/auth/register
public (demo profile only)
Create a TRADER user, account, and fixed simulated ledger-funded balance; role is never accepted from the request. Errors: 400 validation, 409 email exists, 429 rate limit.
POST
/auth/refresh
any
Optional: refresh the token
GET
/me
any
Current user, roles, owned account ids

Orders (tier 1)
Method
Path
Role
Purpose
Notes
POST
/orders
TRADER
Submit an order
202 + orderId, status: RECEIVED. See below.
GET
/orders/{id}
owner, RISK, OPS, ADMIN
Current status snapshot
404 for other traders
GET
/orders
TRADER (own), RISK, OPS, ADMIN
List orders
Filters: status, symbol, from, to; cursor pagination. RISK, OPS and ADMIN must pass accountId
DELETE
/orders/{id}
TRADER
Request cancel
202, status CANCEL_REQUESTED; a cancel racing a fill is decided by arrival order at the single writer
PATCH
/orders/{id}
TRADER
Amend (cancel-replace), core tier
202; a price change loses priority, a quantity reduction keeps it (9.1)
GET
/orders/{id}/events
owner, RISK, OPS, ADMIN
Full audit timeline
Journal seq, type, payload, reservation movements, account snapshot for rejections (P4)

POST /orders body and responses:
{
  "clientOrderId": "c-7f3a9e",
  "symbol": "ACME",
  "side": "BUY",
  "type": "LIMIT",
  "timeInForce": "GTC",
  "quantity": 100,
  "price": "101.25"
}

Status
Meaning
202
Durably received (published with acks=all). Not accepted, not filled. A retry with the same clientOrderId and payload returns 202 with the original orderId.
400
Validation failure: tick or lot violation, non-positive quantity, above the configured maximum or beyond the safe-integer range, unknown symbol
401 / 403
Missing or expired token / wrong role
409
Same clientOrderId with a different payload (payload_hash mismatch, 5.5)
429
Per-account rate limit
503
Gateway could not publish durably. Never 202, no order exists (R10)

Risk failures are not synchronous errors. There is no 422 for insufficient balance; it is an OrderRejected event the client observes (5.6). Market orders use type: MARKET, which the risk stage converts to a capped IOC (5.9).
Market data (tier 1)
Method
Path
Role
Purpose
GET
/instruments
any
Tradable symbols with tick size, lot size, status
GET
/instruments/{symbol}
any
One instrument
GET
/symbols/{symbol}/book?depth=10
any
Order book snapshot, includes the current seq for WebSocket resync
GET
/symbols/{symbol}/trades?limit=50
any
Recent trades
GET
/symbols/{symbol}/status
any
Breaker state, reason, incident start, maxHaltDuration

Accounts and portfolio (tier 1)
Method
Path
Role
Purpose
GET
/accounts/{id}/balances
owner, RISK, OPS, ADMIN
Total, held, available cash, and held amount per symbol with reason
GET
/accounts/{id}/positions
owner, RISK, OPS, ADMIN
Quantity, average cost, mark, unrealized P&L
GET
/accounts/{id}/pnl
owner, RISK, OPS, ADMIN
Realized and unrealized P&L
GET
/accounts/{id}/reservations
owner, RISK, OPS, ADMIN
Open and recent reservations (placed, converted, released)
GET
/accounts/{id}/ledger?from=&to=
owner, RISK, OPS, ADMIN
Double-entry lines with ref_event_id (tier 2)

Risk console (tier 2)
Method
Path
Role
Purpose
Notes
GET
/risk/accounts/{id}/limits
RISK, ADMIN
Read limits


PUT
/risk/accounts/{id}/limits
RISK
Update limits
Audited
GET
/risk/rejections
RISK, ADMIN
Rejections feed
Filters: reason, accountId, symbol, from
GET
/risk/breakers
RISK, ADMIN
All symbols: state, trip reason, incident clock, resting orders, held funds


POST
/risk/symbols/{symbol}/halt
RISK
Manual halt, body { "reason": "..." }
202; journaled as a command, so it replays (5.8)
POST
/risk/symbols/{symbol}/resume
RISK
Resume after a manual halt
202
PUT
/risk/symbols/{symbol}/breaker-config
RISK
Window size N, thresholds, cooldown, maxHaltDuration
Audited

Reconciliation (tier 2)
Method
Path
Role
Purpose
Notes
POST
/recon/runs
OPS
Upload the external statement (multipart/form-data)
202 + runId. Idempotent by file hash: re-upload returns the existing run, no duplicate breaks (X5)
GET
/recon/runs
OPS, ADMIN
List runs with counts per break type


GET
/recon/runs/{id}
OPS, ADMIN
One run


GET
/recon/breaks
OPS, ADMIN
List breaks
Filters: runId, type, status
GET
/recon/breaks/{id}
OPS, ADMIN
Break detail: internal vs external record


POST
/recon/breaks/{id}/status
OPS
Move to investigating, body { "reason": "..." }
Reason mandatory
POST
/recon/breaks/{id}/resolve
OPS
Resolve or write off, body { "resolution", "reason", "adjustment"? }
Reason mandatory; an adjustment produces a ledger entry (X6)
GET
/recon/breaks/{id}/audit
OPS, ADMIN
Audit trail of every change



Admin (tier 3, role ADMIN)
Method
Path
Purpose
GET / POST
/admin/users
List, create users and assign roles
GET / POST
/admin/accounts
List, create accounts
POST
/admin/accounts/{id}/deposit
Fund an account (simulation); body includes a requestId for idempotency; creates a ledger entry
POST
/admin/instruments
List a new instrument (reference price required, 5.9)
PUT
/admin/instruments/{symbol}
Update tick, lot, band, reference price, status
POST
/admin/demo/reset
Reset seeded demo data (demo profile only)

System and proof dashboard (tier 2, role ADMIN)
Method
Path
Purpose
Notes
GET
/system/metrics/summary
Throughput, p50/p95/p99, queue depth, consumer lag, event-loop lag
Pre-aggregated for the UI; raw metrics stay on a separate metrics endpoint
GET
/system/shards
Owner instance, fencing epoch, last journal seq, last snapshot seq, lag
Backed by shard_leases (5.7)
GET
/system/invariants
Debits = credits, positions sum to zero, no negative available
Each check returns pass/fail and the offending rows
POST
/system/verify-replay
Run replay-equals-live for a stream (P7)
Returns a diff summary
POST
/system/simulator/start, /stop
Start or stop order flow, body { ratePerSec, symbols }


POST
/system/chaos/kill-shard, /freeze-shard
Kill or freeze a shard (R1, R7)
Demo profile only; return 404 in any other profile
GET
/system/recovery
Last recovery time and tail length
Feeds the recovery curve (F5)

Keep the Prometheus metrics endpoint (prom-client output) and the health endpoint on a separate port, not on the public API.
WebSocket (plain JSON over WebSocket at /ws)
Use ws (through @fastify/websocket) with a small JSON protocol. No STOMP.
Authenticate with the first message: { "op": "auth", "token": "<jwt>" }, with a short timeout (for example 5 seconds) after which the server closes the connection. Do not put the token in the URL, because URLs end up in logs.
Subscribe: { "op": "subscribe", "topic": "book.ACME" } and { "op": "unsubscribe", ... }. The server checks the user's role for each topic.
Keep-alive: the server pings, and drops clients that don't pong. Check socket.bufferedAmount before each send (5.3, read side).
Spring-style user queues are replaced by topics that are automatically scoped to the authenticated user (user.orders, user.account).
Topic
Audience
Payload
book.{symbol}
any
Book delta, plus a snapshot on subscribe. Conflated for slow clients
trades.{symbol}
any
Trades as they happen
breaker
any
Breaker state changes (BreakerTripped, BreakerHalfOpened, BreakerClosed)
user.orders
the trader
Order status changes, in order: accepted, rested, fills, cancelled, rejected
user.account
the trader
Balance and reservation updates, halt start and force-cancel notifications (5.3)
risk.rejections
RISK
Rejections as they happen
system
ADMIN
Shard ownership changes, invariant failures, recovery events

Every message uses one envelope: { "type", "seq", "symbol"?, "ts", "payload" }. Resync rule: the client keeps the last seq per stream. If it sees a gap, or reconnects, it refetches the REST snapshot (for the book: GET /symbols/{symbol}/book, which returns its own seq) and then applies only deltas with a higher seq. This is also what makes conflation safe. One API instance holds its own client connections, so the demo runs a single API instance; state in the README that fan-out across several API instances would need shared pub/sub (for example Redis).
Endpoint-to-page map
Page
Calls
P0 Home and auth
POST /auth/login, POST /auth/register, GET /me
P2 Trading
GET /instruments, /symbols/{s}/book, /trades, /status, POST /orders, DELETE /orders/{id}, GET /orders; WS book, trades, breaker, user.orders
P3 Portfolio
GET /accounts/{id}/balances, /positions, /pnl, /reservations, /ledger; WS user.account
P4 Order detail
GET /orders/{id}, /orders/{id}/events
P5 Risk console
/risk/*; WS risk.rejections, breaker
P6 Reconciliation
/recon/*
P7 System
/system/*; WS system
P8 Admin
/admin/*

Build the endpoints in this order, matching the page tiers: auth, orders, market data, accounts (tier 1); then risk, recon, system (tier 2); then admin (tier 3). Each endpoint needs the integration test noted in 10.7.

6. Core USPs
What makes this different from the typical "stock trading app" resume project:
A real matching engine with price-time priority and a justified data structure, not a CRUD app that displays prices.
Single-writer concurrency design on Node's event loop, with a synchronous deterministic engine, and a measured comparison against a naive concurrent-async version that overspends.
Account-level overspend prevention across shards using reservations, proven by a concurrency test that fails on the naive version and passes on yours.
Event sourcing with snapshots and replay, including kill-the-process recovery tests and measured recovery time.
Every rejection is an event. You can replay the log and prove each rejection was correct given the account state at that moment.
Double-entry ledger and reconciliation workflow, a back-office concern most student projects ignore.
Circuit breaker as a state machine with a defined policy for resting orders.
Honest scaling evidence: single-process optimization, sharding correctness, and contention-aware scale-out experiments with hypotheses written before running them.
Guarantees enforced mechanically, not asserted: fencing epochs for the single writer, time as a journaled input for determinism, and ESLint rules that keep clocks, randomness, I/O and await out of the engine.
Full-stack TypeScript with shared contracts: one common package of validation schemas and the money codec used by the API and the UI.
Deployed, observable and tested, with a README that documents trade-offs.

7. Why This Is Attractive for SDE Roles
What interviewers commonly probe (per public interview reports)
Where this project gives you a real answer
Concurrency and async: the event loop, races across await, when to use worker threads, scaling beyond one process
Synchronous engine, serialized I/O stages, naive-async vs serialized comparison, one process per partition
Low-level design (e.g., design a library or booking system)
Order book classes, state machines, clean package boundaries
Database locks, indexing, normalization
Ledger schema, journal indexing, optimistic vs pessimistic locking discussion
"Design a real-time stock feed or notification system"
Kafka partitioning, WebSocket fan-out, slow consumer handling
"What if a service crashes mid-transaction?"
Event sourcing, replay, idempotency, outbox pattern
"How would you scale this 100x?"
Symbol sharding, account partitioning, CQRS, measured experiments
"How do you prevent duplicate processing?"
Idempotency keys, deduplicating consumers
RAG/AI questions (UBS-style)
Pairs with your RAG project (Project 2). Stretch goal here: an agent that queries positions via tool calling within user permissions.
SQL and schema design (ZS-style)
Ledger, projections, reconciliation queries
"Walk me through your project and its trade-offs"
Section 12 gives you prepared decision records

Not covered by this edition: Java-specific questions (thread pools, Runnable vs Callable, synchronized, ConcurrentHashMap, the Java memory model). Section 14 lists how to prepare those separately.
The meta-reason: interviewers repeatedly ask candidates to defend decisions in their own projects. This project is full of real decisions with trade-offs, and you can show evidence (tests, benchmarks) for each.

8. Features
8.1 MVP (must finish; this alone is a strong project)
[ ] Instruments and accounts with seed data
[ ] Limit and market orders, cancel
[ ] Order book with price-time priority matching (partial fills, multiple fills per order)
[ ] Single-writer engine per symbol (synchronous, in a shard process)
[ ] Append-only event journal
[ ] Snapshot plus replay recovery
[ ] Idempotent, asynchronous order submission (202 after durable receipt)
[ ] Account risk check with reservations (v1: single process, two stages)
[ ] Double-entry ledger with invariant checks
[ ] REST API with JWT auth and roles
[ ] Money codec (bigint <-> decimal string) used at every boundary
[ ] Tier-1 UI (3.4): login, trading screen, portfolio, order audit trail
[ ] Docker, docker-compose, CI, deployed demo
[ ] README with architecture, benchmarks and trade-offs
8.2 Core (target these)
[ ] IOC orders and order amendments (cancel-replace)
[ ] Circuit breaker state machine with rolling volatility
[ ] Reconciliation job with break workflow
[ ] Kafka-based sharding by symbol, risk partitioning by account
[ ] Fencing epochs for single-writer ownership, with zombie-instance tests
[ ] WebSocket market data with conflation and slow-consumer policy
[ ] CQRS projections with Redis
[ ] Metrics dashboards (p50/p95/p99 latency, throughput, queue depth, consumer lag, event-loop lag)
[ ] Market simulator and load-test harness
8.3 Stretch (only if everything above is done and explainable)
[ ] Run the engine in a worker_thread (message passing, or a shared-memory ring buffer) and compare with the main-thread engine
[ ] Replace the sorted-array price index with a balanced tree or skip list, with a benchmark
[ ] Failover test on multiple instances with measured recovery time
[ ] OpenTelemetry distributed tracing
[ ] Natural-language assistant (tool calling) that queries positions and orders only within the user's permissions, with every action audited
[ ] Self-trade prevention, stop orders, FOK orders
[ ] Simple fee model

9. Edge Cases to Handle
Group them in your tests and your README. Each should have a deliberate, documented behavior.
9.1 Matching
Incoming order matches multiple price levels and several orders at each level
Partial fill leaves remainder resting; partial fill of a resting order keeps its time priority
Two orders at the same price arrive in the same instant (sequence number decides, deterministically)
IOC with a cap and no liquidity (nothing fills, the order is cancelled, the reservation is fully released)
IOC sweeping the whole book (the price cap stops it)
Limit order priced through the market (executes at the resting price, not its own)
Cancel of an order that is already filled, already cancelled, or never existed
Cancel racing with a fill (the single writer's order of arrival decides; behavior must be deterministic)
Amend that changes price (loses priority) vs amend that only reduces quantity (keeps priority; decide and document)
Zero or negative quantity, quantity not a multiple of lot size, price not on a tick
Quantity or price above the configured maximum, or a JSON number beyond the safe-integer range (rejected at the edge; bigint arithmetic never wraps, but unbounded sizes are refused by limits)
Self-trade (same account on both sides): prevent or allow by policy
9.2 Risk and reservations
Same account sends many orders concurrently across several symbols (must never overspend)
Order exactly equal to available balance (allowed), one tick above (rejected)
Partial fill with price improvement (release the difference)
Cancel releases only the remaining reservation, not the filled portion
Reservation placed but OrderAccepted message never reaches the matcher (leaked reservation, needs the sweeper)
Duplicate fill event arrives twice (idempotent conversion)
Sell order with shares already reserved by another open order
Market order when there is no recent trade and no two-sided book (falls back to the static reference price; with none configured, rejected NO_REFERENCE_PRICE, see 5.9)
Reference price moves between the risk check and the match (the hard priceCap still bounds the cost)
Reservations held on a symbol that stays halted for a long time (maxHaltDuration force-cancel, see 5.3)
Two handlers for the same account interleave across an await (must be impossible by construction: awaited loop per partition)
9.3 Event sourcing and recovery
Crash after the journal write but before publishing downstream (replay must republish safely)
Crash in the middle of a snapshot write (must fall back to the previous valid snapshot)
Snapshot older than a large tail of events (recovery time grows; measure it)
Event schema changes between versions (versioned events with upcasters; at least a documented strategy)
Duplicate command with the same clientOrderId but different payload (reject as conflict)
Replay produces a different state than the live run (indicates non-determinism; test must catch it)
Replay executed at a different wall-clock time or on a different machine (must still be identical)
Tick or command arrives with a timestamp lower than the previous one (input stage clamps to keep ts non-decreasing, including after a backwards system clock step)
A bigint field serialized with JSON.stringify (throws, so every payload goes through the money codec)
Postgres returns int8 as a string (the parser must convert to bigint everywhere)
9.4 Messaging, scaling and process health
Consumer crash mid-batch and rebalance (at-least-once delivery plus idempotent handlers)
Zombie instance wakes up after a pause or rebalance and tries to write (must be fenced and fail-stop)
Two instances briefly both believe they own a partition (journal epoch check and (stream_id, seq) key reject the loser)
Event-loop stall or long GC pause exceeds the session timeout, so the partition is reassigned while the old process is still alive (the fencing case that is most likely in Node)
Unhandled promise rejection or uncaught exception (exit the process, let the supervisor restart it; never continue in an unknown state)
SIGTERM during processing (stop consuming, flush the journal, release the lease, exit cleanly)
Out-of-order or duplicate messages across partitions
Hot symbol receiving most of the traffic
Hot account receiving most of the traffic
Consumer lag grows without bound (backpressure policy)
Slow WebSocket client (bounded buffer via bufferedAmount, conflation or disconnect)
Clock skew between instances (never use wall clock for ordering; use sequence numbers)
9.5 Circuit breaker
Trips while many orders are resting (policy decides)
Trips while an incoming order is mid-match (breaker is checked at a defined point in the single-writer loop)
Flapping (opens and closes repeatedly; use cooldown and hysteresis)
Half-open sees a burst of orders (rate cap)
Too few trades to compute volatility (fall back to a safe default or stay closed)
Cancels during the open state (always allowed, release reservations immediately)
Halt lasts longer than maxHaltDuration (resting orders force-cancelled with halt_timeout, reservations released)
Manual halt by a risk officer (no cooldown; stays Open until explicitly resumed, same incident clock applies)
New order for a halted symbol (rejected early by the risk stage, before any reservation)
9.6 Reconciliation
External file missing trades, containing extra trades, or containing duplicates
Same trade with different price or quantity
Trades on the boundary of a cut-off time
Malformed rows, wrong encoding, empty file, huge file (streamed, not loaded whole)
Re-uploading the same file (idempotent run)
A break resolution that must produce a ledger adjustment
9.7 API and security
Missing or expired JWT, wrong role, accessing another account's data
WebSocket client that never sends its auth message (closed after the timeout)
Replayed request with the same idempotency key
Rate limiting per account
Gateway crashes after publishing but before replying 202 (client retries, dedupe returns the original orderId)
Gateway cannot reach Kafka (returns 503, never 202, no order exists)
Input validation errors return structured error bodies, never stack traces

10. Test Cases to Pass
Aim for many small deterministic tests plus a few strong property and concurrency tests. Tests are your evidence in interviews. Use Vitest for everything, fast-check for properties, and Testcontainers (or compose services in CI) for integration tests.
10.1 Unit tests (engine core)
#
Test
Expected
U1
Single buy matches single sell at the same price
One trade, both orders filled, book empty
U2
Buy crosses a lower ask
Trade at the ask price
U3
Large buy sweeps three price levels
Trades at each level, in price order
U4
Two asks at the same price
Earlier order fills first
U5
Partial fill of resting order
Resting order keeps its queue position
U6
Cancel resting order
Removed in O(1), not matchable
U7
Cancel unknown or filled order
Rejected with a defined reason, no state change
U8
IOC with cap, empty book
No trade, order cancelled, reservation released
U9
IOC with cap, cap reached
Remainder cancelled, no trade above the cap
U10
IOC remainder
Unfilled part cancelled, never rests
U11
Tick or lot violation
Rejected
U12
Quantity or price above the configured maximum, or not a safe integer in the request
Rejected at the edge, no precision loss
U13
Market buy, no trades, one-sided book, static reference configured
Converted to IOC with cap from the static reference; reservation = cap x qty
U14
Market buy, no reference price available at all
Rejected NO_REFERENCE_PRICE, no reservation placed
U15
New price level inserted at the best, middle and worst position
Sorted price array stays ordered; best price is always the last element
U22
IOC exactly fills one maker
One trade and no resting IOC order
U23
IOC partially fills then cancels its remainder
Trade followed by IOC_REMAINDER cancellation
U24
IOC respects the inclusive crossing boundary
No trade beyond the cap or floor
U25
SELL IOC sweeps the bid floor
Only bids at or above the floor trade
U26
IOC cap and floor are inclusive
Equality at the bound is executable
U27
Cancelling an IOC id is rejected
IOC never enters the resting index
U28
Order-id reuse after IOC follows the accepted-id policy
The engine's duplicate-id behavior is explicit
U29
IOC self-trade is allowed
Same-account IOC matching is not prevented
U30
IOC remainder event carries remaining quantity
Reservation release input is available to risk
U31
Invalid IOC commands do not mutate state
Validation remains atomic
U32
IOC event sequence is deterministic
Fresh engines produce equal events
U33
Self-trade remains allowed for IOC
Maker and taker may share an account
U34
IOC remainder is terminal
No remainder is rested after cancellation

10.2 Property-based tests (fast-check)
Use fast-check with @fast-check/vitest. It generates random command sequences, prints the seed and a minimal shrunk counterexample on failure, and lets you replay a failure by seed. For richer scenarios, use its model-based testing support (commands run against both the engine and a simple reference model). Assert, over thousands of random sequences:
Generators live in test code, which the purity lint rules do not cover (4.7). Never use randomness inside engine-core/src.
#
Property
P1
The book is never crossed (best bid is always below best ask) after any command
P2
Total quantity filled on buys equals total filled on sells, per symbol
P3
No order is ever filled for more than its quantity
P4
Within a price level, fills respect arrival order
P5
Ledger debits equal credits after every sequence
P6
Sum of positions across all accounts is zero per symbol
P7
Replay equals live: re-executing the journaled stamped commands (including ticks) on an empty engine yields exactly the stored events and the live state
P8
No hidden inputs: replaying the same stamped log at a different wall-clock time gives identical output (backed by the purity lint rules)
P9
For any market order, the total cost of its fills is at most the reservation placed for it
P10
Money codec round trip: for any bigint within bounds, encode to decimal string and decode gives the same value, through JSON, Postgres (int8) and Redis
P11
The sorted price array is always strictly ordered and contains exactly the levels that have resting orders
P12
Every accepted order conserves quantity across fills, cancellation, and resting remainder
Per-instance quantity is conserved
P13
IOC orders never rest and every IOC fill respects its cap or floor
No IOC instance remains in final resting orders
P14
Two fresh engines are deterministic for the same command sequence
Events and final resting orders are equal

Differential test D1 compares every command's event list and the final resting
orders with an independent plain-array reference matcher. Regression examples
EX1 to EX3 cover the Week 2 carry-over examples. Edge quantity parser tests Q1
to Q8 cover canonical strings, safe numbers, bounds, and large exact values.

10.3 Concurrency tests
#
Test
Expected
C1
One account, 3 symbols, hundreds of concurrent orders, balance far below total demand
held <= balance at every observation; no negative available balance
C2
Same test against the naive version (reads the balance with await, then reserves with another await, handlers running concurrently)
Demonstrates overspend (keep this test; it is your proof, and the bug is an await race, not a thread race)
C3
Many concurrent cancels and fills on the same order, fed through the shard input queue
Exactly one outcome, deterministic given arrival order
C4
Duplicate clientOrderId sent concurrently to the gateway
Exactly one order created (unique constraint plus dedupe)
C5
Concurrent submission from many accounts to one symbol
Total fills equal total matched volume; no lost or duplicated orders
C6
Inject an artificial delay at every await inside the risk stage, then send many messages for one account
Messages for one account are still handled one at a time and results are identical

10.4 Recovery and chaos tests
#
Test
Expected
R1
Kill the shard process after N random events, restart
State after recovery equals state of an uninterrupted run
R2
Kill during snapshot write
Falls back to the previous snapshot, then replays
R3
Duplicate delivery of every event
State unchanged versus single delivery
R4
Drop the OrderAccepted message after reservation
Sweeper releases the leaked reservation within the configured window
R5
Restart a consumer mid-batch (Kafka rebalance)
No lost or double-applied events
R6
Measure recovery time vs log tail length
Documented curve
R7
Freeze a shard instance past the session timeout (docker pause on its container, or SIGSTOP on Linux/macOS), let another instance take the partition, then resume the frozen one
Frozen instance's writes are rejected by the epoch check and it fail-stops; no duplicated or missing journal sequence numbers
R8
Force repeated consumer-group rebalances under load
No command applied twice or out of order; invariant tests C1 and P5 to P6 still hold
R9
Kill the gateway after the Kafka publish but before the 202; client retries with the same clientOrderId
Exactly one order; retry returns the original orderId
R10
Make Kafka unavailable to the gateway
Client gets 503, never 202; no order exists
R11
Block the event loop with a busy loop longer than the session timeout (test hook), so the partition is reassigned
The stalled process is fenced when it resumes, fail-stops and restarts; journal has no gaps or duplicates
R12
Send SIGTERM during load
Consumption stops, journal flushed, lease released, process exits cleanly, and a restart resumes with no replay anomalies

10.5 Risk and circuit breaker tests
#
Test
Expected
K1
Order exactly at balance, then one tick above
Accepted, then rejected with reason
K2
Partial fill with price improvement
Excess reservation released
K3
Rejection event contains the account snapshot used
Replay shows the rejection was justified
K4
Price series that should trip the breaker
Closed to Open at the expected trade
K5
Cooldown elapses, stable flow
Open to Half-open to Closed
K6
Instability during half-open
Back to Open
K7
Cancels during open state
Accepted
K8
Flapping input
Hysteresis prevents rapid oscillation
K9
Replay a stamped log containing breaker transitions at a different wall-clock time
Identical transitions at identical sequence numbers
K10
Symbol halted longer than maxHaltDuration with resting orders
Orders force-cancelled (halt_timeout), all reservations released, balances consistent
K11
New order for a halted symbol
Rejected early by the risk stage (symbol_halted) before a reservation; if it raced past, the matcher rejects and the reservation is released
K12
Trader cancels a resting order during a halt
Allowed, reservation released immediately

10.6 Reconciliation tests
#
Test
Expected
X1
External file matches internal exactly
Zero breaks
X2
Missing external trade
"Missing external" break
X3
Price mismatch
"Price mismatch" break with both values
X4
Duplicate external row
"Duplicate" break
X5
Same file uploaded twice
No duplicate breaks created
X6
Resolve a break
Status updated, audit entry written, ledger adjustment if needed

10.7 API, security and integration tests
Testcontainers: Postgres and Kafka end-to-end (submit order, observe fill, observe projection)
Auth: wrong role gets 403, other account's data gets 403 or 404, expired token gets 401
Idempotent POST: a retry returns the original orderId with 202; the order is never created twice
Async contract: POST /orders returns 202 only after the durable publish, and the final outcome is observable via WebSocket and GET /orders/{id}
WebSocket: slow client does not affect a fast client's latency, and a client that never authenticates is closed after the timeout
Contract tests for event schemas
Role matrix: every endpoint in 5.10 is called with each role, and the response is 403 (wrong role) or 404 (another trader's resource) as specified. Include POST /auth/register: public only in the demo profile, creates only TRADER users, ignores any requested role, and returns 400/409/429 as specified. Include the ADMIN rules: GET allowed everywhere, but POST /orders, DELETE /orders/{id}, halt, resume and resolve return 403
POST /orders status codes: 400 for tick/lot/above-maximum/unsafe-integer, 409 for the same clientOrderId with a different payload, 429 over the rate limit, and the 202 retry returns the original orderId
No synchronous risk errors: an order exceeding available cash returns 202, then an OrderRejected event on user.orders and in GET /orders/{id}/events with the account snapshot
WebSocket resync: drop a message (or reconnect), and the client recovers the book from the REST snapshot plus deltas with a higher seq
Demo-only endpoints (/system/chaos/*, /admin/demo/reset) return 404 outside the demo profile
Reconciliation upload is idempotent by file hash (X5 through the API)
Money codec at the boundaries: a bigint posted as a decimal string comes back identical from GET, and no response ever contains a floating-point money value
10.8 Performance tests
#
Test
Report
F1
tinybench: order book add, match, cancel
ops/sec, and allocation behavior from a heap profile
F2
Single shard end-to-end
Throughput, p50, p95, p99 latency, event-loop lag
F3
Naive concurrent-async version vs serialized single-writer
Throughput and correctness (C2) side by side
F4
1, 2, 4 shard processes with CPU limits
Throughput curve plus hypothesis and explanation
F5
Recovery time vs snapshot interval
Chart
F6
Slow consumer scenario
Engine latency unaffected
F7
bigint vs a safe-integer number price index in the hot path (optional)
Measured cost of bigint, to justify decision #3


11. Scaling Plan and Experiments
11.1 Key principle
One order book cannot be parallelized, because order matters. In Node this is natural: a process has one event loop, so one shard process is one writer. Scaling means (a) making one shard process as fast as possible and (b) sharding symbols across processes. The hard part is that account-level risk crosses symbol boundaries, which the reservation model solves.
11.2 Account-level risk across shards: the decision
Orders are first routed by accountId to a risk worker (single writer per account).
The risk worker checks available funds, places a reservation, then emits OrderAccepted keyed by symbol to the matching shard.
Fills and cancels flow back to the account's partition, where reservations convert or release.
Why it works: one account trading three symbols on three shards still passes through one serial point before fan-out. No two orders from that account can pass the same balance check concurrently. This holds only because ownership of an account partition is fenced (5.7); without fencing, a zombie risk worker could double-spend.
Costs to state openly: one extra hop of latency; false rejects while reservations are held; a hot account is serial; market orders need a protection band for a worst-case reservation.
Failure modes to design for: leaked reservations (outbox or transactional write plus periodic sweeper), duplicate fill events (idempotent by fill id).
Build order: v1 runs both stages in one process with two queues. Move the boundary onto Kafka only after v1 is correct and tested.
11.3 Three experiments, three different claims
State in your README what each experiment proves and what it does not.
Experiment
Where
What it proves
What it does NOT prove
E1: Sharding correctness
Laptop
Routing is correct, per-symbol ordering holds, failover plus replay restores correct state
Anything about throughput scaling
E2: Contention-aware scaling
Containers with fixed CPU limits (for example docker run --cpus=1 per shard process, one core each, matching Node's one busy thread), broker and load generator pinned to separate cores; ideally a short run on separate cloud machines
How throughput changes as shard processes are added under stated resource limits, and where the bottleneck moves (shard CPU, then Kafka, then Postgres)
Production-scale numbers
E3: Single-process optimization
Laptop (node --cpu-prof, --heap-prof, tinybench)
Hardware-independent improvement from specific code changes (less allocation, batched journal writes, fewer awaits per command, avoiding bigint churn)
Cluster behavior

Write your hypothesis before running E2, for example: "Throughput should grow roughly linearly with shard processes until the broker or Postgres saturates." Then record the result and explain any deviation. A flat curve on one laptop is an expected artifact of shared CPU and memory bandwidth, not a failed design, and your README should say so.
11.4 What to report for every optimization
A table of: change made, metric before, metric after, hardware, test conditions. Report p50, p95, p99 and event-loop lag, not just average throughput. Node-specific honesty: garbage-collection pauses show up in tail latency, so say so and show the p99.
11.5 Read-side scaling
Separate read models from the matching engine (CQRS).
WebSocket fan-out with per-client bounded buffers, conflation and disconnect policy.
Cache hot reads in Redis. Keep PostgreSQL off the matching hot path.

12. Design Decisions You Must Be Able to Defend
Keep this as a living decision log in docs/decisions.md. For each decision write: context, options considered, choice, trade-offs, how you tested it. Minimum list:
Why one synchronous writer per symbol (one shard process, one event loop) instead of concurrent async handlers? (Benchmark and correctness-test both: C2, F3.)
Why a Map plus sorted price array plus linked lists for the book? Complexity of each operation, and when would you switch to a tree?
Why bigint instead of number or a decimal library? (Correctness first; F7 measures the cost, and you only switch if profiling justifies it.)
Why event sourcing? What does it cost (schema evolution, replay time)?
Snapshot interval: how chosen, what recovery time results?
Account risk: why reservations and a two-stage pipeline rather than a global lock or one process for everything?
What happens to resting orders when the breaker trips, and why?
At-least-once delivery plus idempotency vs exactly-once: why this choice?
Journal in PostgreSQL vs Kafka as source of truth: what did you choose and why?
Why is the engine a zero-dependency, synchronous package rather than part of the web framework?
Where do you use worker threads (or not), and why is the engine not async? (The engine is CPU-bound and must be deterministic; I/O belongs in the shard runner.)
Which parts did you simplify versus a real exchange, and what would you add next?
How do the breaker and every other time-based rule stay deterministic on replay? (Time is a stamped, journaled input; Tick commands; count-based windows where possible; lint enforcement. See 5.8.)
How is "single writer" enforced across rebalances, restarts, event-loop stalls and frozen processes? (Fencing epoch on journal writes, transactional producers, explicit revoke handling, fail-stop. See 5.7.)
How does a market order get a bounded reservation, and what is the reference-price fallback? (Capped IOC conversion and the four-step fallback chain. See 5.9.)
What happens to reserved funds during a long halt? (Early rejection, self-service cancel, maxHaltDuration force-cancel, visibility; documented as a bounded limitation. See 5.3.)
Why is ingress durable through orders.submitted, and what does 202 mean? (One topology, two idempotency boundaries, asynchronous outcomes. See 5.6.)
Why fast-check for property tests? (Maintained, built-in shrinking and seed replay, Vitest integration, model-based testing; license checked. See 4.3 and 10.2.)
Why is the circuit breaker a folder inside engine-core rather than its own package? (It runs inside the single-writer loop under the same no-clock, no-random, no-I/O rules. See 5.3 and 4.4.)
Why Node.js and TypeScript for the backend, and what did you give up? (Event loop as a natural single writer, one language and shared contracts with the UI, strong async I/O for Kafka and WebSockets. Given up: real shared-memory parallelism within a process, the most predictable tail latency because of garbage collection, and Java-specific concurrency tooling. A real low-latency exchange would use a systems language, and you should say so.)
Why is the shard runner its own package? (Keeps engine-core free of I/O, so the purity rules are enforceable. See 5.3.)
Why is TypeScript pinned to 6.0.x when 7.0 is out? (Tooling compatibility: typescript-eslint doesn't support 7 yet. See 4.5, item 1.)
Rule: if you cannot explain a piece of code line by line, simplify it or delete it. A smaller engine you can defend beats a larger one you can't.

13. How to Present on Your Resume
13.1 Project entry template
MatchLedger: Event-Sourced Order Matching and Settlement Engine | TypeScript, Node.js, Kafka, PostgreSQL, Redis, React, Docker | [GitHub] [Live demo]
Built a price-time-priority matching engine with a single-writer-per-symbol design (one event loop per shard); benchmarked against a naive concurrent-async version and measured [X] orders/sec at p99 latency of [Y] ms on [hardware].
Designed an account-level reservation model so concurrent orders across multiple symbols and shards cannot overspend; a concurrency test reproduces the overspend from an await race in the naive version and passes in the final design.
Implemented event sourcing with snapshots and deterministic replay; engine recovers to an identical state after forced crashes in [Z] seconds for a log of [N] events.
Built a double-entry ledger and reconciliation workflow that detects [N] types of breaks against simulated external statements.
Added a per-symbol circuit breaker (state machine driven by rolling volatility) and a Kafka-partitioned scale-out with fencing against zombie writers; documented scaling experiments with explicit hypotheses and limits.
Deployed with Docker and GitHub Actions CI; [N]+ unit, property-based (fast-check), concurrency and chaos tests.
13.2 Rules for resume numbers
Only write numbers you measured, with the hardware noted in the README.
Do not claim "millions of orders per second" or "production-grade". Claim what you can demonstrate in the interview.
Keep to 4 to 6 bullets. Lead with design decisions and verified results, not with technology lists.
If asked "why Node for a trading engine," have decision #20 ready: you chose it deliberately, and you know what it costs.
13.3 Other places to show it
GitHub README: architecture diagram, benchmark tables, decision log, how to run in one command (docker compose up).
A 2 to 3 minute demo video: place orders, watch the book, kill a shard, show recovery, show a reconciliation break (the script in 3.4).
LinkedIn post or short blog: "How I stopped an account from overspending across three shards" or "The await race that broke my matching engine."

14. Company-Specific Tailoring
Public postings and interview reports suggest these emphases. Treat them as angles, not facts about internal systems.
Company
Emphasis to bring forward
Suggested talking points
UBS
Reliability, governed AI, microservice design, low-level design
Crash recovery, audit trail of every decision, optional permission-aware assistant stretch feature, clean package design
Morgan Stanley
Concurrency, scaling, resilience, database fundamentals
Single-writer vs naive-async benchmark, await-race reasoning, DB locks and indexing in the ledger
Apollo (Global Management)
Trade processing, asset servicing, fund accounting, reconciliation
Ledger, reconciliation breaks workflow, correctness invariants. Note: visible Java postings were senior, so use this as a domain angle rather than a main target
ZS
SQL, data modeling, case-style problem solving, AI literacy
Schema design, reconciliation queries, projections. Be ready for SQL and DBMS questions, and for basic generative AI and LLM questions

Covering the Java gap (since this edition doesn't exercise it). If a company's JD leans Java-heavy, expect a few general-concurrency or DSA questions in whatever language they choose for a live round. Prepare separately and briefly: read enough about the Java memory model, synchronized/locks, and Runnable vs Callable/ExecutorService to discuss them conceptually, and be ready to say plainly that your project's concurrency model (single-writer via the event loop, fencing against zombies) is language-agnostic and the same reasoning applies in Java with threads instead of the event loop. Don't claim Java project experience you don't have; frame it as transferable systems reasoning.
Optional legacy-intake feature (Morgan Stanley angle): add a nightly fixed-width or CSV file ingestion path with bad rows, then show how you move it toward event-driven processing without breaking the old path. Discuss incremental migration vs rewrite.

15. Weekly Plan
Assumptions: 10 to 15 hours per week, final-year student, daily DSA practice continuing alongside. Adjust dates to your placement season. A strong smaller version is described at the end of this section.
Week 1: Foundations and setup
Goal: understand the domain and set up the skeleton. How:
Learn the basics: limit order book, bid/ask, price-time priority, market vs limit, partial fills.
Read Kafka basics (topics, partitions, consumer groups, offsets, transactions) and event sourcing basics.
Create the npm workspaces monorepo with all eleven backend packages as empty shells (engine-core, common, journal, shard, risk, ledger, recon, projections, api, simulator, benchmarks), plus web/ as its own app. The breaker is a folder inside engine-core, not its own package. Wire the dependency map (4.4) and the boundary-check script now, so a forbidden dependency fails CI from day one.
Add the CI pipeline that runs lint, build and test, and docker-compose.yml with Postgres, Redis and Kafka at the pinned versions (4.3).
Complete the Day-1 verification checklist (4.6) and commit docs/versions.md.
Write docs/decisions.md with the first three decisions, plus #18 (fast-check), #19 (breaker as a folder) and #20 (why Node), since they are already settled.
Done when: repo builds and lints in CI with all eleven packages present, every item in 4.6 is green, you can explain price-time priority on a whiteboard.
Weeks 2 to 3: Order book and matching (pure TypeScript)
Goal: a correct, tested matching core with zero dependencies. How:
Model Order, Trade, Side, OrderType as plain immutable types (interfaces or readonly classes).
Implement the book: sorted price array, Map per level, doubly linked list, Map<OrderId, OrderNode> for O(1) cancel.
Implement limit, IOC (with cap), cancel.
Make the core deterministic: time and ids are inputs, never read internally; the ESLint purity rules pass.
Write unit tests U1 to U12 and U15, then property tests P1 to P4 and P11.
Done when: all unit and property tests pass; you can explain the complexity of add, match and cancel.
Week 4: Single-writer runner and first benchmark
Goal: concurrency design plus evidence. How:
Wrap the core in the shard runner's input stage: bounded command queue in, event list out, stamping ts (5.8).
Build a deliberately naive concurrent-async version (reads balance, awaits, reserves) for comparison.
Write concurrency tests C2, C3, C5, C6.
tinybench for the core; an end-to-end benchmark comparing single-writer vs naive-async (F3).
Record results in a table; write the decision-log entry for #1.
Done when: you have a comparison table and can explain the await race in the naive version from memory.
Weeks 5 to 6: Event sourcing, snapshots, recovery
Goal: the crash-recovery story. How:
Define event types and versioned payloads; define the money codec in common and test it (P10).
Implement the append-only journal (PostgreSQL, batched inserts) and sequence numbers.
Implement snapshots and recovery (snapshot plus tail replay).
Add idempotency by clientOrderId at the gateway and again at the risk stage (5.6).
Journal the stamped commands and Ticks; recovery re-executes them (5.8). Write P8.
Write property test P7 (replay equals live) and recovery tests R1 to R3, R6.
Add a chaos harness that kills the shard process at random points.
Done when: after random kills, recovered state always equals the uninterrupted run; you can show the recovery-time curve.
Week 7: Risk stage, reservations and ledger
Goal: the hardest design in the project. How:
Keep the naive version from week 4 and write test C2 to prove it overspends.
Implement the account-partitioned risk stage with the awaited-loop serialization rule (9.2) and the reservation lifecycle (place, convert, release).
Convert market orders to capped IOC orders using the reference-price fallback chain (5.9); write U13, U14 and P9.
Rejections emit OrderRejected with the account snapshot.
Implement the double-entry ledger with invariant checks (P5, P6).
Write C1, K1 to K3, R4 (leaked reservation sweeper).
Start in one process with two queues; keep Kafka for later.
Done when: C1 passes, C2 still fails on the naive version (kept as proof), and you can draw the reservation lifecycle from memory.
Week 8: Circuit breaker and reconciliation
Goal: the two features that show domain awareness. How:
Implement the breaker state machine in engine-core/src/breaker, with rolling volatility, driven by stamped time (5.8); document the resting-order policy.
Implement the halt policy: early rejection for halted symbols, maxHaltDuration force-cancel, and the funds-held notification (5.3).
Write K4 to K12.
Build the reconciliation job: streamed CSV ingestion, matching rules, break types, workflow statuses.
Write X1 to X6.
Done when: you can demo a breaker trip and recovery, and a reconciliation run producing breaks you can resolve.
Week 9: API, WebSocket and read side
Goal: make it usable and demoable. How:
Fastify REST API (orders, accounts, positions, reconciliation), JWT auth (jose) and roles, zod validation, RFC 9457 errors.
Orders are asynchronous: POST /orders returns 202 after the durable publish (5.6); outcomes arrive over WebSocket and GET /orders/{id}.
Projections for order status, positions and top of book; Redis for hot reads.
WebSocket (ws) fan-out with bounded buffers and conflation; test a slow client.
Build the endpoints in the order given in 5.10 (auth, orders, market data, accounts), with the integration tests from 10.7.
React UI by tier (3.4): tier 1 is P1 to P4. Build P1 to P4, P5 and P6 together in week 9 — all six backends are ready by then (P1 to P4 from this week's API work, P5 and P6 from week 8), so sequence them by whichever is fastest to wire up. Add P7 (system dashboard) in week 11, because it needs fencing data from week 10 and metrics from week 11.
Stop UI work when the 3-minute demo script runs end to end.
Done when: an end-to-end demo works from the browser; integration tests with Testcontainers pass.
Week 10: Kafka, sharding and scaling experiments
Goal: distributed version with honest measurement. How:
Move the stage boundaries onto Kafka (topic layout, 5.4).
Implement fencing (5.7): lease epochs on journal writes, transactional producers, explicit revoke handling, fail-stop on SIGTERM and uncaught errors.
Run E1 (sharding correctness, failover and replay on a laptop).
Run E2 with CPU limits per container; write your hypothesis first, then record results and explain deviations.
Test hot-symbol, consumer-lag and event-loop-stall scenarios; write R5, R7 to R12.
Done when: you have a scaling write-up that states what each experiment proves and what it does not, and the zombie-instance test (R7) and the event-loop-stall test (R11) both pass.
Week 11: Observability, optimization and load testing
Goal: find and fix real bottlenecks. How:
Add prom-client metrics, Prometheus and Grafana dashboards (latency percentiles, throughput, queue depth, consumer lag, event-loop lag, breaker state).
Profile (node --cpu-prof, --heap-prof), fix top hotspots (allocation, journal batching, fewer awaits per command), re-measure after each change (E3). Optionally run F7 to justify the bigint decision with numbers.
Run k6 and a Kafka producer load test; record before and after tables.
Done when: your README contains an optimization table with at least three measured improvements.
Week 12: Deployment, documentation and interview prep
Goal: make the project presentable and defensible. How:
Deploy with Docker on a small cloud VM; keep the demo link stable.
Finish README (architecture diagrams, how to run, benchmark tables, decision log, limitations).
Record the 2 to 3 minute demo video.
Write resume bullets using only measured numbers (13.1).
Rehearse the pitch and the Q&A in section 16 out loud, and do mock interviews with a friend or senior.
Done when: a stranger can run it in one command, and you can explain every package without notes.
Buffer
Add 1 to 2 weeks of buffer. Things will slip, especially Kafka transactional fencing and benchmarking.
Compressed plan (about 7 weeks)
If time is short, build the strong core and skip the rest:
Week
Focus
1
Setup and fundamentals (all eleven package shells, Day-1 checklist)
2 to 3
Order book plus tests
4
Single-writer runner plus naive-vs-serialized benchmark
5
Event journal, snapshots, replay, recovery tests
6
Reservations (in-process), ledger, REST API, minimal UI
7
Deployment, README, benchmarks, interview prep

Then add reconciliation, the circuit breaker and Kafka sharding only if time remains, in that order. This is the floor referenced in section 17: never cut matching tests, the single-writer design, journal plus replay, reservations with the overspend proof, or deployment.

16. Interview Pitch and Q&A
16.1 The 30-second pitch
"I built a trading engine in TypeScript that matches orders with price-time priority, one shard process per symbol, so there's no locking on the hot path — the event loop gives me a single writer for free. The interesting part was keeping an account from overspending when it trades across several symbols handled by different shards. I solved that with a reservation model and proved it with a test that reproduces an await race in a naive version and passes in mine. It's event-sourced, so I can kill a shard mid-trade, replay the log, and recover to an identical state, and every rejection is itself an event I can audit. I deployed it and measured throughput and tail latency, including event-loop lag."
16.2 The 2-minute version (structure)
Problem: matching must be serial per symbol, but risk is per account across symbols.
Approach: one event loop per shard (single writer for free), reservations per account, event log for recovery.
Hardest part: the reservation model and what it costs (extra hop, false rejects).
Evidence: the await-race concurrency test, recovery tests, benchmark table.
Honest limits: simulation, no real market data, scaling measured under stated resource limits, GC pauses show up in tail latency.
What next: a worker_thread comparison, real multi-machine failover, more order types.
16.3 Pitching to a specific company
Use the "problem of this kind" framing and then ask a question:
"Back-office systems depend on books agreeing across systems, so I built a reconciliation workflow with break types and a resolution audit trail. How do your teams handle breaks today?"
"I treated every decision as something that must be explainable later, so rejections are events I can replay. How does your team handle audit requirements?"
"Systems like yours often run across many instances, so I built fencing to handle zombie writers after a rebalance or a stalled event loop. How do you handle split-brain scenarios?"
Never claim you know their internal problems. Ask.
16.4 Likely questions and answer sketches
Question
Sketch of a strong answer
Why one writer per symbol instead of concurrent handlers?
Order matters per symbol, so matching is inherently serial. Node's event loop gives me that for free within one process; I benchmarked it against a naive concurrent-async version and it's both faster and correct where the naive one overspends.
How do you prevent an account from overspending across symbols?
Route by account to a serial risk worker first, inside an awaited loop so no two messages for one account interleave. Place a reservation, then fan out to symbol shards. My naive version did two separate awaits (read balance, then reserve) and a concurrent test caught it overspending.
What are the downsides of reservations?
Extra hop, temporary false rejects, hot accounts are serial, market orders need a protection band.
What if the shard process crashes mid-trade?
Replay from the latest snapshot plus event tail. Commands are idempotent by clientOrderId, consumers deduplicate. I tested this with forced kills: recovery in [Z] seconds for [N] events.
What if a reservation is placed but the order never reaches the matcher?
Write the reservation and outgoing message atomically, make the matcher idempotent, and run a sweeper that releases reservations without a live order.
How would you scale 100x?
Shard symbols across processes, partition risk by account, separate reads (CQRS), cache hot reads. A hot symbol can't be sharded because one book is serial, so you optimize that single process.
Why not use worker threads or a thread pool?
The engine is CPU-bound and must stay deterministic and single-writer per symbol; threads would need explicit synchronization to keep that guarantee, which is exactly what I avoided. I'd consider a worker thread per shard as a stretch, for isolation, not for parallelism within one symbol.
What stops two shard instances from both owning a partition during a rebalance?
Kafka's assignment isn't a safety guarantee, so I fence: a lease epoch checked on every journal write, a transactional producer with producer-epoch fencing, and explicit revoke handling. A zombie's writes fail and the process exits (fail-stop). I tested it by freezing an instance past the session timeout.
What's a Node-specific failure mode you had to handle?
An event-loop stall or a long GC pause can exceed the Kafka session timeout and trigger a rebalance while the old process is still alive — that's a real zombie scenario here, not a hypothetical. Fencing handles it the same way as any other rebalance.
Why bigint instead of number?
number loses precision past 2^53, which is not safe for money. bigint is exact. I measured the performance cost in the hot path and it was acceptable; I'd only switch if profiling showed otherwise.
How is your circuit breaker deterministic on replay?
Time is an input. The shard's input stage stamps and journals each command and injects Ticks, and the engine compares stamped times, never the wall clock. Volatility is count-based. ESLint rules keep clock and random calls out of the engine, and a test replays at a different time.
What does your 202 mean?
The order is durably received (published with acks=all), not accepted or filled. Outcomes are asynchronous, and dedupe happens at the gateway and again at the risk stage.
Why Node for a trading engine instead of Java or a systems language?
Deliberate trade-off: the event loop gives me single-writer-per-process for free, and I get one language end to end with shared validation schemas. I gave up real shared-memory parallelism and predictable tail latency because of GC — a real low-latency exchange would use a systems language, and I say so in the README.
Walk me through a bug you found.
The naive risk-stage version: it read an account's balance, then awaited a reservation write; two orders for the same account could both pass the balance check before either write landed, because the await let the event loop interleave them. Fixing it meant serializing per-account handling in an awaited loop, not adding a lock.

16.5 Whiteboard exercises to practice
Draw the order book data structure and walk through an incoming order that sweeps two levels.
Draw the reservation lifecycle for a partial fill with price improvement.
Draw the circuit breaker state machine and explain what happens to resting orders.
Draw the Kafka topic and partition layout and explain where the single-writer guarantee comes from, and what fencing adds on top of it.
Draw the naive-async await race from C2/C6 on a whiteboard, line by line, and show where serialization fixes it.

17. Scope Control and Common Mistakes
Do
Build in layers. Don't start the next layer until the current one is tested and explainable.
Write the failing test first for the hard problems (overspend, replay mismatch).
Keep engine-core free of dependencies, I/O and async.
Record measurements as you go, with the hardware and conditions.
Deploy early and keep it deployed.
Don't
Don't add technologies you can't justify in one sentence.
Don't use number for money, and don't let a bigint cross a JSON boundary unencoded.
Don't use a plain object {} as a price-level or any integer-keyed map; use Map.
Don't read the clock, use randomness, or await anything inside engine-core.
Don't run more than one handler for the same account or symbol concurrently (no Promise.all over messages for one partition).
Don't claim scaling from a single laptop run without framing what it proves.
Don't copy a matching engine from GitHub and present it as yours. Interviewers will ask for line-by-line reasoning.
Don't spend more than about 10% of your time on the UI.
Don't let AI tools write code you don't understand. Use them to explain, review and generate test ideas, then write and verify the core yourself.
Don't skip the Day-1 version checklist; a version-skew surprise (TypeScript/ESLint, Kafka client/Node) costs far more time later than checking it costs now.
If you're running out of time
Cut in this order: stretch features, then Kafka sharding, then the circuit breaker, then reconciliation. Never cut: matching tests, the single-writer design, journal plus replay, reservations with the overspend proof, and deployment.

18. Repository Structure and README Checklist
18.1 Suggested structure
Eleven backend packages in an npm workspaces monorepo, plus web/ and docs/. The circuit breaker is a folder inside engine-core.
matchledger/
  packages/
    engine-core/        # pure TypeScript, zero deps: order book, matching, and the breaker
      src/book/          # order book, price levels
      src/matching/      # matching logic, commands, events
      src/breaker/       # circuit breaker state machine (a folder, not a package)
    common/              # shared types, zod schemas, money codec (browser-safe)
    journal/             # event store, snapshots, recovery (pg)
    shard/               # impure runner: input stage, Kafka I/O, fencing, crash policy
    risk/                # account risk stage, reservations
    ledger/              # double-entry ledger, invariants
    recon/               # reconciliation job and break workflow
    projections/         # CQRS read models (pg + Redis)
    api/                 # Fastify REST + WebSocket + auth
    simulator/           # order flow generator and load-test tools
    benchmarks/          # tinybench, k6 scripts, experiment configs
  web/                   # React dashboard (its own app); pages P1 to P9 from 3.4
  docs/
    architecture.md
    decisions.md         # the decision log (12)
    experiments.md       # hypotheses, results, what each does NOT prove (11.3)
    versions.md          # pinned versions and dependency snapshot (4.3, 4.6)
  scripts/
    check-boundaries.mjs # enforces the dependency map (4.4)
  docker-compose.yml
  .github/workflows/ci.yml
  package.json
  tsconfig.base.json
  eslint.config.js
  README.md

18.2 README checklist
[ ] One-paragraph problem statement and one-paragraph solution
[ ] Architecture diagram and order lifecycle diagram
[ ] One-command local run (docker compose up, then npm ci && npm run build)
[ ] Link to the live demo and the demo video
[ ] Feature list with what is implemented and what is out of scope
[ ] Test strategy summary (unit, property, concurrency, chaos) with how to run each
[ ] Benchmark tables with hardware, conditions and before/after, including event-loop lag
[ ] Scaling experiments E1 to E3 with the hypothesis and "what this does not prove"
[ ] Link to the decision log, including decision #20 (why Node, what was given up)
[ ] Known limitations and what you'd build next
[ ] docs/versions.md linked, so a reader can see exactly what was pinned and why

End of blueprint. Start with Week 1, keep the decision log updated as you go, and revisit this document at the end of each phase to check whether your "done when" criteria are actually met.

### Week 3 test IDs (added)
| ID | Test | Location |
|---|---|---|
| U8-U10 | IOC cap with empty book, cap reached, remainder never rests | packages/engine-core/test/ioc.test.ts |
| U12a/U12b | max quantity/price in engine; edge quantity parser | ioc.test.ts; packages/common/test/quantity.test.ts |
| U22-U34 | IOC exact fill, partial, boundaries, duplicates, validation, FIFO, level removal, sweep, self-trade, cancel reasons | ioc.test.ts |
| EX1-EX3 | worked examples (sweep/cancel, FIFO, head/middle/tail) | packages/engine-core/test/examples.test.ts |
| Q1-Q8 | quantity parser cases | packages/common/test/quantity.test.ts |
| P12-P14 | accounting of every accepted order, IOC never rests and stays within limit, deterministic replay | packages/engine-core/test/properties.test.ts |
