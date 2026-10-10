# MatchLedger: Full Architecture, API and Test-Plan Prompts (GitHub Copilot)

You pasted the Week 2 prompts without checking the results, so run **Prompt V first**. It changes nothing and tells you what Copilot actually did. Then run **A1, A2, A3**. These produce documentation only: no code, no endpoints implemented. They write the target design so every later week's prompt can point at one detailed spec.

Use Copilot **Agent mode**. Attach `#file:docs/BLUEPRINT.md` and `#file:docs/week2-plan.md` to every prompt. Run the commands in Prompt V yourself too, and don't rely on Copilot's summary.

---

## Prompt V: verify what Week 2 produced (read-only)

```
READ-ONLY AUDIT. Do not create, edit, delete or install anything.

1. Run `git status --short` and `git log --oneline -15`.
2. Run, once each, and paste the first 15 lines of any failure: `npm run build`, `npm run lint`, `npm run check:boundaries`, `npm test`.
3. In packages/engine-core: list files under src/ and every test file; print the "dependencies" object of packages/engine-core/package.json (must be empty).
4. For each item say DONE / PARTIAL / MISSING with one line of evidence (file path):
   - types: Side, OrderType, InstrumentConfig, PlaceOrder/CancelOrder/Tick commands, the six events with engineSeq and ts, RejectReason, CancelReason, BookView
   - OrderBook with Map + sorted bigint[] (best = LAST element) + linked-list levels + Map<orderId,node>
   - Engine.apply and snapshotView; validation order (duplicate, quantity, price, tick, lot, maxQuantity, maxPrice)
   - LIMIT matching; IOC with cap; CancelOrder
   - tests U1-U12, U15; property tests P1-P4, P11, determinism, model equivalence, rejections-don't-mutate
   - tinybench benchmark and results in docs/experiments.md
   - decisions.md entries (#2, cancel reason, self-trade, duplicate ids)
5. Scan packages/engine-core/src for: async, await, Promise, Date, Math.random, node: imports, plain-object maps keyed by price or id, number/bigint mixing, TODO, "not implemented".
6. Output only: a table (Item | Status | Evidence), "Command results", "Violations found", "Next prompt to run (6, 7, 8, 9 or 10) and what is left in it". Max 60 lines.
```

Paste the output here if anything is red. I'll write the fix prompt.

---

## Prompt A1: system architecture document

Attach `#file:docs/BLUEPRINT.md`.

```
DOCUMENTATION ONLY. Create or fully rewrite docs/architecture.md. Do not touch any code, config or other docs. Write it as the single architecture reference for the project: precise, no marketing language, every claim traceable to docs/BLUEPRINT.md (cite section numbers like "(5.7)"). Mark every component and flow with the week it gets built (Week 1-12 per the blueprint plan) and a status: IMPLEMENTED (only what exists in the repo now), PLANNED.

Sections, in this order:

1. Purpose and non-goals (simulation of the hard parts; no real money or market data).
2. System context diagram (mermaid): actors (Trader, Risk officer, Ops analyst, Admin, Market simulator) and the system boundary.
3. Container/package diagram (mermaid) of the 11 backend packages plus web, with the allowed-dependency edges from blueprint 4.4 and the forbidden ones listed in a table beneath it.
4. Component specifications, one subsection each, with: responsibility, inputs, outputs, state owned, invariants, failure behavior, package, build week:
   - engine-core (book, matching, breaker folder): synchronous, deterministic, zero dependencies; purity rules; time as input
   - shard runner (input stage, journaling, ts stamping with ts = max(lastTs, now), Tick injection, snapshots, recovery, fail-stop, SIGTERM handling)
   - risk stage (account partition, awaited-loop serialization, reservation lifecycle place/convert/release, market-order to capped IOC conversion with the 4-step reference-price chain, early symbol_halted rejection, rejection event carries account snapshot)
   - journal (append-only table, record_type COMMAND|EVENT, (stream_id, seq) PK, writer_epoch, batched inserts, snapshots)
   - ledger (double entry, append-only, invariants), recon (streamed CSV, break types, workflow statuses), projections (CQRS read models, Redis), api (Fastify gateway, auth, WebSocket), simulator, benchmarks, web.
5. Order lifecycle: sequence diagram (mermaid) for the three paths: filled, rejected for insufficient_balance (rejected before any reservation, no OrderAccepted), rejected symbol_halted. Include the order status state machine (RECEIVED, ACCEPTED, RESTING, PARTIALLY_FILLED, FILLED, CANCEL_REQUESTED, CANCELLED, REJECTED) as a mermaid stateDiagram with the event that causes each transition.
6. Event catalogue: a table of every event (OrderSubmitted, OrderAccepted, OrderRejected, OrderRested, TradeExecuted, OrderCancelled, CancelRejected, ReservationPlaced, ReservationConverted, ReservationReleased, BreakerTripped, BreakerHalfOpened, BreakerClosed, Tick) with: producer, consumers, key fields (types: bigint money as decimal string at boundaries), ordering key, idempotency key.
7. Kafka topic layout (5.4) as a table, plus the v1 in-process equivalent.
8. Data model: an ER diagram (mermaid erDiagram) and a table per table with column, type, constraints, index, owner package (accounts, instruments, order_requests, shard_leases, journal, snapshots, ledger_entries, reservations, orders_view, positions_view, recon_runs, recon_breaks, plus users and risk_limits which the API needs: define their columns). All money/price/quantity columns BIGINT.
9. Concurrency and correctness guarantees, each with: the guarantee, the mechanism, where it is enforced, the test that proves it (use test ids from blueprint section 10): single writer + fencing epochs, no await races, determinism and replay, idempotency at two boundaries, reservation safety bound, halt policy and maxHaltDuration.
10. Failure-mode table: crash points (after journal before publish, mid-snapshot, gateway after publish before 202, zombie after pause, event-loop stall past session timeout, Kafka down) -> detection -> recovery -> test id.
11. Security model: JWT claims {sub, role, accountIds, exp}, role capabilities matrix (rows: TRADER, RISK, OPS, ADMIN; columns: the action groups), 404-vs-403 rule, demo-profile-only features.
12. Observability: metrics list with names (prom-client): orders_received_total, orders_rejected_total{reason}, match_latency_seconds histogram, journal_append_seconds, kafka_consumer_lag, event_loop_lag_seconds, ws_clients, ws_conflated_total, breaker_state{symbol}.
13. Deployment topology (docker-compose services, ports, which are demo-only), environment variables table (name, default, used by).
14. Build-status matrix: component x week x status, and a "Known limitations" list.

Validate the document: every mermaid block must be syntactically valid; every section number cited must exist in docs/BLUEPRINT.md. List any blueprint ambiguity you had to resolve at the end under "Assumptions" instead of silently deciding.
Update PROGRESS.md.
```

---

## Prompt A2: API contract (endpoints, fields, errors, WebSocket)

Attach `#file:docs/BLUEPRINT.md`.

```
DOCUMENTATION ONLY. Create docs/api.md and a matching hand-written docs/openapi.yaml (OpenAPI 3.1). Do not touch code. Source: blueprint 5.10 and 3.4. Where this prompt adds detail, this prompt wins; note any conflict with the blueprint in an "Assumptions" section.

GLOBAL RULES (state once at the top of docs/api.md)
- Base path /api/v1. JSON. Auth: Authorization: Bearer <JWT> (jose, HS256 for demo). Content-Type application/json except /recon/runs (multipart/form-data).
- Money and prices: decimal strings ("101.25"), never JSON numbers. Quantities: integers within Number.MAX_SAFE_INTEGER, sent as JSON numbers or digit strings. Timestamps: ISO-8601 UTC strings. Ids: strings (ord_xxxx, trd_xxxx, acc_xxxx, run_xxxx, brk_xxxx).
- Errors: RFC 9457 application/problem+json: {type, title, status, code, detail, requestId, errors?: [{field, message}]}. Stable codes: VALIDATION_ERROR(400), UNAUTHENTICATED(401), FORBIDDEN(403), NOT_FOUND(404), CONFLICT(409), RATE_LIMITED(429), UNAVAILABLE(503). Never a stack trace.
- Headers: X-Request-Id on every response (echo or generate); Retry-After on 429/503.
- 404 (not 403) for another trader's resource; 403 for role mismatch. ADMIN may call every GET but no trading or risk or recon write.
- Async commands return 202; the outcome arrives via WebSocket and GET.
- Pagination: ?limit=1..100 (default 50) &cursor=<opaque>; response {items: [], nextCursor: string|null}; newest first.
- Rate limit: 60 order writes/min per account (configurable) -> 429.

For EVERY endpoint document: method + path, roles, purpose, path/query params with types and constraints, request body schema (field, type, required, constraints, example), success response (status + schema + example JSON), error responses (status + code + when), idempotency, side effects (events produced), tier/build week, and the test ids that cover it. Use these field definitions exactly:

AUTH
- POST /auth/login (public). Body {email: string(email), password: string(8..128)}. 200 {accessToken, tokenType:"Bearer", expiresIn: 3600, user:{id, email, role:"TRADER"|"RISK"|"OPS"|"ADMIN", accountIds:[string]}}. 401 UNAUTHENTICATED on bad credentials (same message for unknown email and wrong password).
- POST /auth/register (public, demo profile only; 404 outside demo). Body {email, password}. Creates a TRADER user plus one account funded with a fixed simulated amount through a ledger deposit. Role is never read from the body (unknown fields rejected with 400). 201 {user:{id,email,role:"TRADER",accountIds:[...]}}. 400, 409 CONFLICT (email exists), 429.
- POST /auth/refresh (any role): 200 same shape as login.
- GET /me (any): 200 {id, email, role, accountIds}.

ORDERS
- POST /orders (TRADER). Body {clientOrderId: string(1..64, [A-Za-z0-9_-]), symbol: string, side:"BUY"|"SELL", type:"LIMIT"|"MARKET", timeInForce:"GTC"|"IOC", quantity: integer>0, price: decimal string (required for LIMIT, forbidden for MARKET)}. Validation: symbol exists, price multiple of tickSize, quantity multiple of lotSize, <= maxQuantity and maxPrice, MARKET requires IOC. 202 {orderId, clientOrderId, status:"RECEIVED", receivedAt}. Retry with same clientOrderId and identical payload -> 202 with the ORIGINAL orderId. Same clientOrderId, different payload -> 409. Publish failure -> 503, never 202. Risk failures are NOT synchronous errors (no 422).
- GET /orders/{id} (owner, RISK, OPS, ADMIN). 200 {orderId, clientOrderId, accountId, symbol, side, type, timeInForce, quantity, filledQuantity, remainingQuantity, price|null, averageFillPrice|null, status, rejectReason|null, createdAt, updatedAt}. status enum: RECEIVED, ACCEPTED, RESTING, PARTIALLY_FILLED, FILLED, CANCEL_REQUESTED, CANCELLED, REJECTED. rejectReason enum: insufficient_balance, insufficient_shares, symbol_halted, breaker_open, NO_REFERENCE_PRICE, halt_timeout, invalid_order.
- GET /orders (TRADER own; RISK/OPS/ADMIN must pass accountId). Query: status, symbol, from, to, limit, cursor, accountId. 200 {items:[order summary], nextCursor}.
- DELETE /orders/{id} (TRADER owner). 202 {orderId, status:"CANCEL_REQUESTED"}. Cancel of an order not resting still returns 202; the outcome is a CancelRejected event.
- PATCH /orders/{id} (TRADER owner). Body {price?: decimal string, quantity?: integer} at least one. Cancel-replace: price change loses priority, quantity reduction keeps it, quantity increase loses priority. 202 {orderId, status:"AMEND_REQUESTED"}. 409 if the order is terminal.
- GET /orders/{id}/events (owner, RISK, OPS, ADMIN). 200 {orderId, events:[{journalSeq: integer, ts, type, payload: object}], reservationMovements:[{event, placed, converted, released}], accountSnapshot: null | {totalCash, heldCash, availableCash, requiredAmount, ruleApplied}}. accountSnapshot is present only for REJECTED orders. Money fields are decimal strings. A rejected-for-balance order has exactly OrderSubmitted then OrderRejected and an empty reservationMovements.

MARKET DATA (any authenticated role)
- GET /instruments -> {items:[{symbol, tickSize, lotSize, maxQuantity, maxPrice, protectionBandBps, status:"ACTIVE"|"HALTED"|"DELISTED"}]}
- GET /instruments/{symbol}; 404 unknown.
- GET /symbols/{symbol}/book?depth=1..50 (default 10) -> {symbol, seq, bids:[{price, quantity, cumulative}], asks:[...], spread, lastPrice|null}. bids best-first descending, asks best-first ascending.
- GET /symbols/{symbol}/trades?limit=1..200 (default 50) -> {items:[{tradeId, price, quantity, ts, takerSide}]}
- GET /symbols/{symbol}/status -> {symbol, state:"CLOSED"|"OPEN"|"HALF_OPEN", reason|null, incidentStartedAt|null, incidentElapsedMs|null, maxHaltDurationMs}

ACCOUNTS (owner, RISK, OPS, ADMIN; others 404)
- GET /accounts/{id}/balances -> {accountId, total, held, available, heldBySymbol:[{symbol, amount, reason:"RESTING_ORDER"|"SYMBOL_HALTED"}]}. Invariant available = total - held >= 0.
- GET /accounts/{id}/positions -> {items:[{symbol, quantity, averageCost, markPrice, unrealizedPnl, realizedPnl}]}
- GET /accounts/{id}/pnl -> {realized, unrealized, total}
- GET /accounts/{id}/reservations?status=&limit=&cursor= -> {items:[{orderId, symbol, placed, converted, released, remaining, status:"ACTIVE"|"FILLED"|"RELEASED"}], nextCursor}
- GET /accounts/{id}/ledger?from=&to=&limit=&cursor= -> {items:[{entryId, txId, ts, asset, amount, direction:"DEBIT"|"CREDIT", refEventId}], nextCursor}

RISK (tier 2)
- GET /risk/accounts/{id}/limits (RISK, ADMIN) -> {accountId, maxOrderNotional, maxOpenOrders, maxPositionPerSymbol}; PUT same path (RISK) with the same body, audited, 200 with the new limits.
- GET /risk/rejections (RISK, ADMIN) filters reason, accountId, symbol, from + pagination -> {items:[{orderId, accountId, symbol, reason, needed, available, ts}], nextCursor}
- GET /risk/breakers (RISK, ADMIN) -> {items:[{symbol, state, tripReason|null, measuredVolatility|null, threshold, incidentStartedAt|null, incidentElapsedMs|null, maxHaltDurationMs, restingOrders, fundsHeld}]}
- POST /risk/symbols/{symbol}/halt (RISK) body {reason: string(5..200)} -> 202 {symbol, status:"HALT_REQUESTED"}; journaled as a command. 409 if already halted.
- POST /risk/symbols/{symbol}/resume (RISK) body {reason} -> 202; 409 if not manually halted.
- PUT /risk/symbols/{symbol}/breaker-config (RISK) body {windowTrades:int>=5, volatilityThresholdBps:int, cooldownMs:int, maxHaltDurationMs:int} -> 200 echo, audited.

RECONCILIATION (tier 2)
- POST /recon/runs (OPS) multipart field "file" (CSV, max 20 MB, header: tradeId,symbol,side,quantity,price,tradeDate). 202 {runId, status:"PROCESSING", duplicate:false}. Same file hash -> 200 {runId (existing), status, duplicate:true}, no new breaks. Bad CSV -> 400 with row/line errors.
- GET /recon/runs (OPS, ADMIN) -> {items:[{runId, filename, startedAt, finishedAt|null, counts:{MISSING_INTERNAL, MISSING_EXTERNAL, QUANTITY_MISMATCH, PRICE_MISMATCH, DUPLICATE, LATE}}], nextCursor}
- GET /recon/runs/{id}; GET /recon/breaks?runId=&type=&status= ; GET /recon/breaks/{id} -> {breakId, runId, type, tradeId, internal:{quantity,price}|null, external:{quantity,price}|null, status:"OPEN"|"INVESTIGATING"|"RESOLVED"|"WRITTEN_OFF", ageSeconds}
- POST /recon/breaks/{id}/status (OPS) body {status:"INVESTIGATING", reason: string(5..500)} -> 200 break.
- POST /recon/breaks/{id}/resolve (OPS) body {resolution:"RESOLVED"|"WRITTEN_OFF", reason: string(5..500), adjustment?: {accountId, asset, amount: decimal string, direction}} -> 200; an adjustment writes a balanced ledger entry pair. 409 if already closed.
- GET /recon/breaks/{id}/audit -> {items:[{ts, actor, fromStatus, toStatus, reason}]}

ADMIN (ADMIN only; tier 3): GET/POST /admin/users, GET/POST /admin/accounts, POST /admin/accounts/{id}/deposit body {requestId: string(1..64), amount: decimal string>0} (idempotent by requestId, creates ledger entry), POST /admin/instruments, PUT /admin/instruments/{symbol} (reference price required on create), POST /admin/demo/reset (demo profile only, 404 otherwise).

SYSTEM (ADMIN only; tier 2): GET /system/metrics/summary -> {throughputPerSec, latencyMs:{p50,p95,p99}, queueDepth, consumerLag, eventLoopLagMs}; GET /system/shards -> {items:[{symbol, ownerInstance, fencingEpoch, lastJournalSeq, lastSnapshotSeq, lagMs}]}; GET /system/invariants -> {items:[{name, passed, offendingRows}]} with names ledger_debits_equal_credits, positions_sum_zero_per_symbol, no_negative_available_cash, replay_equals_live; POST /system/verify-replay body {symbol} -> {equal: boolean, diffSummary}; POST /system/simulator/start body {ratePerSec: int 1..5000, symbols:[string]} and /stop; POST /system/chaos/kill-shard and /freeze-shard body {symbol} (demo profile only, else 404); GET /system/recovery -> {lastRecoveryMs, tailLength}. Metrics (prom-client) and /health on a separate port, not under /api/v1.

WEBSOCKET /ws (plain JSON, ws library)
- Client first message within 5 s: {"op":"auth","token":"<jwt>"} -> {"type":"auth.ok","user":{...}} or close code 4401. No token in the URL.
- {"op":"subscribe","topic":"book.ACME"} / {"op":"unsubscribe",...}; unauthorized topic -> {"type":"error","code":"FORBIDDEN","topic":...}.
- Topics and audience: book.{symbol} (any), trades.{symbol} (any), breaker (any), user.orders (own), user.account (own), risk.rejections (RISK), system (ADMIN).
- Envelope for every server message: {type, seq: integer, symbol?, ts, payload}. seq increases per stream with no gaps; client refetches REST snapshot on a gap or reconnect, then applies only deltas with higher seq. Server pings every 15 s and closes clients that miss a pong; checks socket.bufferedAmount (limit 1 MiB) and conflates book updates for slow clients or disconnects with code 4408.
- Payload schemas for each type: book.snapshot, book.delta, trade, breaker.changed, order.updated {orderId,status,filledQuantity,remainingQuantity,rejectReason?}, account.updated {total,held,available}, risk.rejection, system.event.

Also produce: a role x endpoint matrix table (rows endpoints, columns TRADER/RISK/OPS/ADMIN/public with Y / N-403 / own-only-404), an endpoint-to-page map (P0 home/auth, P2 trading, P3 portfolio, P4 order detail, P5 risk, P6 recon, P7 system, P8 admin), and an endpoint-to-build-week table. docs/openapi.yaml must define every schema under components/schemas and every endpoint; validate it parses (run a YAML lint or `npx @redocly/cli lint` if available; do not add it as a dependency, use npx only). Update PROGRESS.md.
```

---

## Prompt A3: complete test plan and traceability

Attach `#file:docs/BLUEPRINT.md` and `#file:docs/api.md`.

```
DOCUMENTATION ONLY. Create docs/test-plan.md. Do not write test code. Source: blueprint section 10 and docs/api.md. This is the contract every later week's tests must satisfy.

1. Test strategy: layers (unit, property, concurrency, recovery/chaos, risk/breaker, recon, API/contract, security, WebSocket, integration with containers, performance), tools (Vitest 4, fast-check 4, Testcontainers or compose in CI, tinybench, k6), where each runs (every push in the verify job, containers in the integration job, chaos and perf nightly or manual), seed policy (fixed seed in CI, random seed locally, always print seed on failure), and flakiness policy (a flaky test is a bug in the code or the test; never retry-to-green).
2. For EVERY test id in blueprint section 10 (U1-U15, P1-P11, C1-C6, R1-R12, K1-K12, X1-X6, F1-F7), a table row: ID | Setup (exact inputs) | Action | Expected result with concrete values | Package | Build week | Automation level (unit/CI/manual) | Status (DONE only if it exists in the repo now, else PLANNED). Write concrete numbers, for example U3: asks 101.00x10, 101.05x10, 101.10x10; buy 101.10x25 -> trades 10@101.00, 10@101.05, 5@101.10, remainder 0.
3. Additional engine tests added in this repo (determinism, model equivalence, rejections-don't-mutate, engineSeq gap-free, duplicate id after fill, cancel-then-reuse id rejected, constructor config validation) with ids E1.. and the same columns.
4. API test matrix, generated from docs/api.md: for EVERY endpoint, rows for: 200/202 happy path, 400 per validation rule (list each rule), 401 missing token, 401 expired token, 403 wrong role, 404 other trader's resource, 409/429/503 where defined, idempotency replay, and money-as-string assertions (no JSON number ever used for money). Give each an id AT-<area>-<n> and the exact request and expected status/code/body fields.
5. Role matrix test: describe how a single table-driven test calls every endpoint with each of TRADER, RISK, OPS, ADMIN and anonymous and asserts the expected status from the matrix in docs/api.md.
6. WebSocket tests (WT-1..): auth timeout, bad token, subscribe forbidden topic, seq gap resync, slow client conflation does not delay fast client, ping/pong drop, reconnect.
7. UI acceptance checklist tied to the Stitch screens (P0, P2 Default/Halted/Order rejected, P3 Default/Empty, P4 Filled/Rejected): for each screen list the data elements and the endpoint field that feeds each, and the states to verify (loading, empty, error, stale connection).
8. End-to-end demo script test (the 3-minute script in blueprint 3.4) as a numbered manual checklist with expected observations.
9. Traceability matrix: requirement (blueprint section 1 table rows and the 8.1 MVP checklist) -> mechanism -> test ids. Every MVP checklist item must map to at least one test id; list any that do not under "Gaps".
10. Exit criteria per week (Weeks 1-12): the test ids that must be green to close that week.
11. A "How to run" section: exact npm scripts to run each layer (propose script names such as test:unit, test:property, test:integration, test:chaos, bench) and mark which already exist in package.json (check, do not assume).
Update PROGRESS.md.
```

---

## After the three prompts

- [ ] `git diff --stat` shows only `docs/*` and `PROGRESS.md` changed (no code)
- [ ] Open `docs/architecture.md` in a markdown preview with mermaid support and confirm every diagram renders
- [ ] `docs/openapi.yaml` parses (`npx @redocly/cli lint docs/openapi.yaml`)
- [ ] Spot check three endpoints in `docs/api.md` against the table in this file: `POST /orders`, `GET /orders/{id}/events`, `POST /recon/runs`
- [ ] Spot check five test ids in `docs/test-plan.md` have concrete numbers, not prose
- [ ] Commit: `docs: architecture, api contract, test plan`

Send me the Prompt V output first, then tell me which of the three docs Copilot finished. Copilot may stop partway on long documents. If it does, say "Continue from the last completed section; do not rewrite earlier sections".