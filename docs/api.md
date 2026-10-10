# API contract

## Global rules

- Base path: `/api/v1`; JSON is used everywhere except `POST /recon/runs`,
  which uses `multipart/form-data`.
- Authentication: Authorization: Bearer <JWT> (demo uses jose, HS256). Every
  response includes X-Request-Id (echoed or generated). Retry-After is
  included on 429 and 503 responses.
- Money and prices are decimal strings, never JSON numbers. Quantities are
  digit strings in responses and integers or digit strings in requests.
  Timestamps are ISO-8601 UTC strings. IDs (except trade ids, which are `<symbol>-T<n>`, e.g. `ACME-T1`) are
  strings using the `ord_`, `acc_`, `run_`, or `brk_` prefixes.
- Errors use RFC 9457 `application/problem+json`:
  `{type,title,status,code,detail,requestId,errors?:[{field,message}]}`.
  Stable codes are `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401),
  `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409),
  `RATE_LIMITED` (429), and `UNAVAILABLE` (503). Stack traces are never sent.
- A request for another trader's resource returns 404; a role mismatch returns
  403. ADMIN may call every GET but cannot perform trading, risk, or
  reconciliation writes.
- Asynchronous commands return 202 and remain pending until an outcome event is
  received over WebSocket and is visible through GET.
- Pagination is `limit=1..100` (default 50) and opaque `cursor`; responses are
  `{items:[],nextCursor:string|null}`, newest first.
- Order writes are limited to 60 per minute per account (configurable).

## Assumptions

- This prompt wins where it adds fields, examples, or constraints not present
  in blueprint sections 3.4 and 5.10. In particular, the prompt makes
  registration explicitly demo-profile-only, fixes pagination limits, and
  specifies the exact error envelope and response field names.
- The prompt uses `PATCH /orders/{id}` for amend and includes risk and
  reconciliation detail shapes that the blueprint describes at a higher level.
- WebSocket delivery is described below but is not represented as an HTTP
  OpenAPI path.

## Endpoint contract

Every entry includes roles, purpose, parameters/body, success shape/example,
errors, idempotency, side effects, tier/week, and covering test IDs.

### Authentication and identity

#### POST `/auth/login`

- **Roles/purpose:** public; exchange credentials for a JWT.
- **Parameters/body:** JSON `{email:string(email),password:string(8..128)}`.
- **Success:** 200 `{accessToken,tokenType:"Bearer",expiresIn:3600,user:{id,email,role,accountIds}}`.
  Example: `{"accessToken":"ey...","tokenType":"Bearer","expiresIn":3600,"user":{"id":"usr_1","email":"a@example.com","role":"TRADER","accountIds":["acc_1"]}}`.
- **Errors:** 400 `VALIDATION_ERROR`; 401 `UNAUTHENTICATED` for either unknown
  email or wrong password, with the same message; 429 `RATE_LIMITED`.
- **Idempotency/side effects:** no mutation; repeated valid login issues a new
  token. **Tier/week/tests:** tier 1, Week 9; AUTH-LOGIN, ROLE-MATRIX.

#### POST `/auth/register`

- **Roles/purpose:** public in demo profile; create a TRADER and one account.
- **Parameters/body:** JSON `{email:string(email),password:string(8..128)}`;
  unknown fields are rejected.
- **Success:** 201 `{"user":{"id":"usr_1","email":"a@example.com","role":"TRADER","accountIds":["acc_1"]}}`.
- **Errors:** 400 `VALIDATION_ERROR`; 404 `NOT_FOUND` outside demo; 409
  `CONFLICT` when email exists; 429 `RATE_LIMITED`.
- **Idempotency/side effects:** not idempotent; creates user, account, and a
  fixed simulated ledger deposit. **Tier/week/tests:** tier 1, Week 9;
  AUTH-REGISTER, ROLE-MATRIX.

#### POST `/auth/refresh`

- **Roles/purpose:** any authenticated role; refresh a token.
- **Parameters/body:** no body; bearer token required.
- **Success:** 200, same schema as login.
- **Errors:** 401 `UNAUTHENTICATED`; 429 `RATE_LIMITED`.
- **Idempotency/side effects:** repeatable token issuance; no domain event.
  **Tier/week/tests:** tier 1, Week 9; AUTH-REFRESH.

#### GET `/me`

- **Roles/purpose:** any authenticated role; return current identity.
- **Parameters/body:** none.
- **Success:** 200 `{"id":"usr_1","email":"a@example.com","role":"TRADER","accountIds":["acc_1"]}`.
- **Errors:** 401 `UNAUTHENTICATED`.
- **Idempotency/side effects:** read-only. **Tier/week/tests:** tier 1, Week 9;
  AUTH-ME.

### Orders

#### POST `/orders`

- **Roles/purpose:** TRADER; submit an order.
- **Parameters/body:** JSON fields `clientOrderId:string(1..64,[A-Za-z0-9_-])`,
  `symbol:string`, `side:BUY|SELL`, `type:LIMIT|MARKET`,
  `timeInForce:GTC|IOC`, `quantity:integer>0`, and
  `price:decimal-string` required for LIMIT and forbidden for MARKET.
  Tick/lot, maximum, safe-integer, symbol, and MARKET-IOC validation apply.
- **Success:** 202 `{"orderId":"ord_1","clientOrderId":"c-7f3a9e","status":"RECEIVED","receivedAt":"2026-01-01T00:00:00Z"}`.
- **Errors:** 400 `VALIDATION_ERROR`; 401 `UNAUTHENTICATED`; 403
  `FORBIDDEN`; 409 `CONFLICT` for a same client ID with different payload;
  429 `RATE_LIMITED`; 503 `UNAVAILABLE` if durable publish fails. Risk
  failures are asynchronous and never 422.
- **Idempotency/side effects:** same account/client ID and identical payload
  returns the original 202/order ID. Produces OrderSubmitted and later
  accepted, rejected, trade, rested, or cancelled events. **Tier/week:** tier
  1, Week 9. **Tests:** ORDERS-POST, IDEMPOTENCY, RISK-ASYNC, ROLE-MATRIX.

#### GET `/orders/{id}`

- **Roles/purpose:** owner, RISK, OPS, ADMIN; current order projection.
- **Parameters/body:** path `id:string` (`ord_...`); no body.
- **Success:** 200 order `{orderId,clientOrderId,accountId,symbol,side,type,timeInForce,quantity,filledQuantity,remainingQuantity,price:null|decimal-string,averageFillPrice:null|decimal-string,status,rejectReason:null|string,createdAt,updatedAt}`.
  Statuses are `RECEIVED,ACCEPTED,RESTING,PARTIALLY_FILLED,FILLED,CANCEL_REQUESTED,CANCELLED,REJECTED`.
- **Errors:** 401 `UNAUTHENTICATED`; 403 `FORBIDDEN`; 404 `NOT_FOUND`.
- **Idempotency/side effects:** read-only. **Tier/week:** tier 1, Week 9;
  ORDERS-GET, ROLE-MATRIX.

#### GET `/orders`

- **Roles/purpose:** TRADER's own orders; RISK/OPS/ADMIN require `accountId`.
- **Parameters/body:** query `status,symbol,from,to,accountId`; `limit=1..100`
  default 50; opaque `cursor`; no body.
- **Success:** 200 `{"items":[orderSummary],"nextCursor":null}`.
- **Errors:** 400 `VALIDATION_ERROR`; 401 `UNAUTHENTICATED`; 403
  `FORBIDDEN`; 404 `NOT_FOUND` for an inaccessible account.
- **Idempotency/side effects:** read-only. **Tier/week:** tier 1, Week 9;
  ORDERS-LIST, PAGINATION, ROLE-MATRIX.

#### DELETE `/orders/{id}`

- **Roles/purpose:** TRADER owner; request cancellation.
- **Parameters/body:** path `id`; no body.
- **Success:** 202 `{"orderId":"ord_1","status":"CANCEL_REQUESTED"}`.
- **Errors:** 401 `UNAUTHENTICATED`; 403 `FORBIDDEN`; 404 `NOT_FOUND`;
  429 `RATE_LIMITED`.
- **Idempotency/side effects:** command is safe to retry at the gateway; outcome
  is `OrderCancelled` or `CancelRejected` after single-writer ordering.
  **Tier/week:** tier 1, Week 9; ORDERS-CANCEL, ROLE-MATRIX.

#### PATCH `/orders/{id}`

- **Roles/purpose:** TRADER owner; cancel-replace amend.
- **Parameters/body:** path `id`; JSON `{price?:decimal-string,quantity?:integer}`,
  at least one field. Price change or quantity increase loses priority;
  quantity reduction keeps priority.
- **Success:** 202 `{"orderId":"ord_1","status":"AMEND_REQUESTED"}`.
- **Errors:** 400 `VALIDATION_ERROR`; 401 `UNAUTHENTICATED`; 403
  `FORBIDDEN`; 404 `NOT_FOUND`; 409 `CONFLICT` for terminal orders; 429
  `RATE_LIMITED`.
- **Idempotency/side effects:** request identity/payload must be deduplicated;
  emits cancel-replace and resulting order events. **Tier/week:** tier 1, Week
  9; ORDERS-AMEND, ROLE-MATRIX.

#### GET `/orders/{id}/events`

- **Roles/purpose:** owner, RISK, OPS, ADMIN; complete audit timeline.
- **Parameters/body:** path `id`; no body.
- **Success:** 200 `{"orderId":"ord_1","events":[{"journalSeq":1,"ts":"2026-01-01T00:00:00Z","type":"OrderSubmitted","payload":{}}],"reservationMovements":[{"event":"ReservationPlaced","placed":"101.25","converted":"0","released":"0"}],"accountSnapshot":null}`.
  `events[].journalSeq` and `events[].ts` are the journal sequence and
  ISO-8601 UTC timestamp; `events[].type` is the event name and
  `events[].payload` is its object payload. `reservationMovements[]` contains
  `{event,placed,converted,released}`. `accountSnapshot` is
  `{totalCash,heldCash,availableCash,requiredAmount,ruleApplied}` and is
  non-null only for `REJECTED` orders. A balance-rejected order has exactly
  `OrderSubmitted` followed by `OrderRejected`, with
  `reservationMovements: []`.
- **Errors:** 401 `UNAUTHENTICATED`; 403 `FORBIDDEN`; 404 `NOT_FOUND`.
- **Idempotency/side effects:** read-only. **Tier/week:** tier 1, Week 9;
  AUDIT-TIMELINE, REJECTION-AUDIT.

### Market data

#### GET `/instruments`

- **Roles/purpose:** any authenticated role; list instruments.
- **Parameters/body:** none.
- **Success:** 200 `{"items":[{"symbol":"ACME","tickSize":"0.05","lotSize":"10","maxQuantity":"1000","maxPrice":"2000.00","protectionBandBps":500,"status":"ACTIVE"}]}`.
- **Errors:** 401 `UNAUTHENTICATED`.
- **Idempotency/side effects:** read-only. **Tier/week:** tier 1, Week 9;
  MARKET-INSTRUMENTS.

#### GET `/instruments/{symbol}`

- **Roles/purpose:** any authenticated role; read one instrument.
- **Parameters/body:** path `symbol:string`.
- **Success:** 200 one instrument in the `/instruments` shape.
- **Errors:** 401 `UNAUTHENTICATED`; 404 `NOT_FOUND`.
- **Idempotency/side effects:** read-only. **Tier/week:** tier 1, Week 9;
  MARKET-INSTRUMENT.

#### GET `/symbols/{symbol}/book`

- **Roles/purpose:** any authenticated role; top-of-book snapshot.
- **Parameters/body:** path `symbol`; query `depth=1..50`, default 10.
- **Success:** 200 `{"symbol":"ACME","seq":42,"bids":[{"price":"101.25","quantity":"100","cumulative":"100"}],"asks":[],"spread":null,"lastPrice":null}`.
- **Errors:** 400 `VALIDATION_ERROR`; 401 `UNAUTHENTICATED`; 404 `NOT_FOUND`.
- **Idempotency/side effects:** read-only; `seq` supports WebSocket resync.
  **Tier/week:** tier 1, Week 9; MARKET-BOOK, SEQ-RESYNC.

#### GET `/symbols/{symbol}/trades`

- **Roles/purpose:** any authenticated role; recent trades.
- **Parameters/body:** path `symbol`; query `limit=1..200`, default 50.
- **Success:** 200 `{"items":[{"tradeId":"ACME-T1","price":"101.25","quantity":"10","ts":"2026-01-01T00:00:00Z","takerSide":"BUY"}]}`.
- **Errors:** 400 `VALIDATION_ERROR`; 401 `UNAUTHENTICATED`; 404 `NOT_FOUND`.
- **Idempotency/side effects:** read-only. **Tier/week:** tier 1, Week 9;
  MARKET-TRADES.

#### GET `/symbols/{symbol}/status`

- **Roles/purpose:** any authenticated role; breaker state.
- **Parameters/body:** path `symbol`.
- **Success:** 200 `{"symbol":"ACME","state":"OPEN","reason":null,"incidentStartedAt":null,"incidentElapsedMs":null,"maxHaltDurationMs":60000}`.
- **Errors:** 401 `UNAUTHENTICATED`; 404 `NOT_FOUND`.
- **Idempotency/side effects:** read-only. **Tier/week:** tier 1, Week 9;
  MARKET-STATUS.

### Accounts

For all account endpoints below, roles are owner/RISK/OPS/ADMIN; other roles
receive 404 rather than leaking account existence. The path parameter is
`id:string` (`acc_...`). Each is read-only and has 401/403/404 errors.

#### GET `/accounts/{id}/balances`

- **Purpose/body:** balances and held amounts; no body.
- **Success:** 200 `{"accountId":"acc_1","total":"10000.00","held":"101.25","available":"9898.75","heldBySymbol":[{"symbol":"ACME","amount":"10","reason":"RESTING_ORDER"}]}`.
- **Tier/tests:** tier 1, Week 9; ACCOUNT-BALANCES, ROLE-MATRIX.

#### GET `/accounts/{id}/positions`

- **Purpose/body:** positions; no body.
- **Success:** 200 `{"items":[{"symbol":"ACME","quantity":"10","averageCost":"101.25","markPrice":"102.00","unrealizedPnl":"7.50","realizedPnl":"0"}]}`.
- **Tier/tests:** tier 1, Week 9; ACCOUNT-POSITIONS.

#### GET `/accounts/{id}/pnl`

- **Purpose/body:** realized and unrealized P&L; no body.
- **Success:** 200 `{"realized":"10.00","unrealized":"7.50","total":"17.50"}`.
- **Tier/tests:** tier 1, Week 9; ACCOUNT-PNL.

#### GET `/accounts/{id}/reservations`

- **Purpose/body:** reservation history; query `status`, `limit=1..100`,
  `cursor`; no body.
- **Success:** 200 `{"items":[{"orderId":"ord_1","symbol":"ACME","placed":"101.25","converted":"0","released":"101.25","remaining":"0","status":"RELEASED"}],"nextCursor":null}`.
- **Errors:** add 400 `VALIDATION_ERROR` for filters. **Tier/tests:** tier 2,
  Week 9; ACCOUNT-RESERVATIONS, PAGINATION.

#### GET `/accounts/{id}/ledger`

- **Purpose/body:** double-entry lines; query `from,to,limit=1..100,cursor`.
- **Success:** 200 `{"items":[{"entryId":"led_1","txId":"tx_1","ts":"2026-01-01T00:00:00Z","asset":"USD","amount":"101.25","direction":"DEBIT","refEventId":"evt_1"}],"nextCursor":null}`.
- **Errors:** add 400 `VALIDATION_ERROR` for date/pagination filters. **Tier/tests:**
  tier 2, Week 9; ACCOUNT-LEDGER, PAGINATION.

### Risk

#### GET `/risk/accounts/{id}/limits`

- **Roles/purpose:** RISK, ADMIN; read risk limits. Path `id=acc_...`.
- **Success:** 200 `{"accountId":"acc_1","maxOrderNotional":"10000.00","maxOpenOrders":100,"maxPositionPerSymbol":"1000"}`.
- **Errors:** 401/403/404 as above. **Idempotency/side effects:** read-only.
  **Tier/week/tests:** tier 2, Week 9 (backend Week 7); RISK-LIMITS.

#### PUT `/risk/accounts/{id}/limits`

- **Roles/purpose:** RISK; update limits. Body requires
  `maxOrderNotional:decimal-string,maxOpenOrders:integer,maxPositionPerSymbol:decimal-string`.
- **Success:** 200 echoes the limits object.
- **Errors:** 400 `VALIDATION_ERROR`; 401/403/404; 409 `CONFLICT`; 429
  `RATE_LIMITED`. **Idempotency/side effects:** audited mutation. **Tier/week/tests:**
  tier 2, Week 9 (backend Week 7); RISK-LIMITS-WRITE.

#### GET `/risk/rejections`

- **Roles/purpose:** RISK, ADMIN; rejection feed.
- **Parameters/body:** query `reason,accountId,symbol,from,limit=1..100,cursor`.
- **Success:** 200 `{"items":[{"orderId":"ord_1","accountId":"acc_1","symbol":"ACME","reason":"insufficient_balance","needed":"101.25","available":"10.00","ts":"2026-01-01T00:00:00Z"}],"nextCursor":null}`.
- **Errors:** 400 `VALIDATION_ERROR`; 401/403. **Idempotency/side effects:**
  read-only. **Tier/week/tests:** tier 2, Week 9 (backend Week 7); RISK-REJECTIONS.

#### GET `/risk/breakers`

- **Roles/purpose:** RISK, ADMIN; all breaker states.
- **Success:** 200 `{"items":[{"symbol":"ACME","state":"CLOSED","tripReason":null,"measuredVolatility":null,"threshold":"50","incidentStartedAt":null,"incidentElapsedMs":null,"maxHaltDurationMs":60000,"restingOrders":0,"fundsHeld":"0"}]}`.
- **Errors:** 401/403. **Idempotency/side effects:** read-only. **Tier/week/tests:**
  tier 2, Week 9 (backend Week 8); RISK-BREAKERS.

#### POST `/risk/symbols/{symbol}/halt`

- **Roles/purpose:** RISK; request a manual halt. Path `symbol`; body
  `{reason:string(5..200)}`.
- **Success:** 202 `{"symbol":"ACME","status":"HALT_REQUESTED"}`.
- **Errors:** 400 `VALIDATION_ERROR`; 401/403/404; 409 `CONFLICT` if halted;
  429 `RATE_LIMITED`. **Idempotency/side effects:** journaled command and
  breaker events. **Tier/week/tests:** tier 2, Week 9 (backend Week 8); RISK-HALT.

#### POST `/risk/symbols/{symbol}/resume`

- **Roles/purpose:** RISK; resume a manually halted symbol. Body
  `{reason:string(5..200)}`.
- **Success:** 202 `{"symbol":"ACME","status":"RESUME_REQUESTED"}`.
- **Errors:** 400 `VALIDATION_ERROR`; 401/403/404; 409 `CONFLICT` if not
  manually halted; 429 `RATE_LIMITED`. **Idempotency/side effects:** journaled
  command and breaker events. **Tier/week/tests:** tier 2, Week 9 (backend Week 8); RISK-RESUME.

#### PUT `/risk/symbols/{symbol}/breaker-config`

- **Roles/purpose:** RISK; update breaker policy. Body
  `{windowTrades:int>=5,volatilityThresholdBps:int,cooldownMs:int,maxHaltDurationMs:int}`.
- **Success:** 200 echoes the configuration.
- **Errors:** 400 `VALIDATION_ERROR`; 401/403/404; 409 `CONFLICT`. **Idempotency/
  side effects:** audited mutation. **Tier/week/tests:** tier 2, Week 9 (backend Weeks 7 to 8);
  RISK-BREAKER-CONFIG.

### Reconciliation

#### POST `/recon/runs`

- **Roles/purpose:** OPS; upload an external CSV statement.
- **Parameters/body:** multipart field `file`, CSV <=20 MB with header
  `tradeId,symbol,side,quantity,price,tradeDate`.
- **Success:** 202 `{"runId":"run_1","status":"PROCESSING","duplicate":false}`.
  Same file hash returns 200 with existing run and `duplicate:true`.
- **Errors:** 400 `VALIDATION_ERROR` with row/line errors; 401/403; 409
  `CONFLICT`; 429 `RATE_LIMITED`; 503 `UNAVAILABLE`.
- **Idempotency/side effects:** file hash is idempotency key; creates a
  reconciliation run and later breaks. **Tier/week/tests:** tier 2, Week 9 (backend Weeks 7 to 8);
  RECON-UPLOAD, RECON-IDEMPOTENCY.

#### GET `/recon/runs`

- **Roles/purpose:** OPS, ADMIN; list runs.
- **Parameters/body:** `limit=1..100,cursor`; no body.
- **Success:** 200 `{"items":[{"runId":"run_1","filename":"statement.csv","startedAt":"2026-01-01T00:00:00Z","finishedAt":null,"counts":{"MISSING_INTERNAL":0,"MISSING_EXTERNAL":0,"QUANTITY_MISMATCH":0,"PRICE_MISMATCH":0,"DUPLICATE":0,"LATE":0}}],"nextCursor":null}`.
- **Errors:** 401/403. **Idempotency/side effects:** read-only. **Tier/week/tests:**
  tier 2, Week 9 (backend Weeks 7 to 8); RECON-RUNS.

#### GET `/recon/runs/{id}`

- **Roles/purpose:** OPS, ADMIN; one run. Path `id=run_...`.
- **Success:** 200 one run in the list shape.
- **Errors:** 401/403/404. **Idempotency/side effects:** read-only. **Tier/week/tests:**
  tier 2, Week 9 (backend Weeks 7 to 8); RECON-RUN.

#### GET `/recon/breaks`

- **Roles/purpose:** OPS, ADMIN; list breaks.
- **Parameters/body:** query `runId,type,status,limit=1..100,cursor`.
- **Success:** 200 `{"items":[{"breakId":"brk_1","runId":"run_1","type":"PRICE_MISMATCH","tradeId":"ACME-T1","status":"OPEN"}],"nextCursor":null}`.
- **Errors:** 400 `VALIDATION_ERROR`; 401/403. **Idempotency/side effects:**
  read-only. **Tier/week/tests:** tier 2, Week 9 (backend Weeks 7 to 8); RECON-BREAKS.

#### GET `/recon/breaks/{id}`

- **Roles/purpose:** OPS, ADMIN; break detail. Path `id=brk_...`.
- **Success:** 200 `{"breakId":"brk_1","runId":"run_1","type":"PRICE_MISMATCH","tradeId":"ACME-T1","internal":{"quantity":"10","price":"101.25"},"external":{"quantity":"10","price":"101.30"},"status":"OPEN","ageSeconds":12}`.
- **Errors:** 401/403/404. **Idempotency/side effects:** read-only. **Tier/week/tests:**
  tier 2, Week 9 (backend Weeks 7 to 8); RECON-BREAK.

#### POST `/recon/breaks/{id}/status`

- **Roles/purpose:** OPS; move an open break to `INVESTIGATING`. Body
  `{status:"INVESTIGATING",reason:string(5..500)}`.
- **Success:** 200 break detail.
- **Errors:** 400 `VALIDATION_ERROR`; 401/403/404; 409 `CONFLICT` for an invalid
  transition; 429 `RATE_LIMITED`.
- **Idempotency/side effects:** audited status event. **Tier/week/tests:** tier
  2, Week 9 (backend Weeks 7 to 8); RECON-STATUS.

#### POST `/recon/breaks/{id}/resolve`

- **Roles/purpose:** OPS; resolve or write off a break. Body
  `{resolution:"RESOLVED"|"WRITTEN_OFF",reason:string(5..500),adjustment?:{accountId,asset,amount:decimal-string,direction}}`.
- **Success:** 200 break detail; an adjustment writes a balanced ledger entry
  pair.
- **Errors:** 400 `VALIDATION_ERROR`; 401/403/404; 409 `CONFLICT` if already
  closed; 429 `RATE_LIMITED`.
- **Idempotency/side effects:** audited resolution and optional ledger
  adjustment. **Tier/week/tests:** tier 2, Week 9 (backend Weeks 7 to 8);
  RECON-RESOLVE.

#### GET `/recon/breaks/{id}/audit`

- **Roles/purpose:** OPS, ADMIN; read break audit history.
- **Success:** 200 `{"items":[{"ts":"2026-01-01T00:00:00Z","actor":"usr_1","fromStatus":"OPEN","toStatus":"INVESTIGATING","reason":"Reviewing"}]}`.
- **Errors:** 401/403/404. **Idempotency/side effects:** read-only.
  **Tier/week/tests:** tier 2, Week 9 (backend Weeks 7 to 8); RECON-AUDIT.

### Administration

#### GET `/admin/users`

- **Roles/purpose:** ADMIN; list users. Query `limit,cursor`.
- **Success:** 200 `{"items":[{"id":"usr_1","email":"a@example.com","role":"TRADER","accountIds":["acc_1"]}],"nextCursor":null}`.
- **Errors:** 401/403. **Idempotency/side effects:** read-only. **Tier/week:**
  tier 3, Week 9; ADMIN-USERS.

#### POST `/admin/users`

- **Roles/purpose:** ADMIN; create a user. Body `{email,password,role,accountIds?}`.
- **Success:** 201 user.
- **Errors:** 400/401/403/409/429. **Idempotency/side effects:** creates an
  identity. **Tier/week:** tier 3, Week 9; ADMIN-USERS.

#### GET `/admin/accounts`

- **Roles/purpose:** ADMIN; list accounts. Query `limit,cursor`.
- **Success:** 200 account summaries with `nextCursor`.
- **Errors:** 401/403. **Idempotency/side effects:** read-only. **Tier/week:**
  tier 3, Week 9; ADMIN-ACCOUNTS.

#### POST `/admin/accounts`

- **Roles/purpose:** ADMIN; create an account. Body `{ownerUserId:string}`.
- **Success:** 201 `{"accountId":"acc_1","ownerUserId":"usr_1"}`.
- **Errors:** 400/401/403/404/409/429. **Idempotency/side effects:** creates
  an unfunded account. **Tier/week:** tier 3, Week 9; ADMIN-ACCOUNTS.

#### POST `/admin/accounts/{id}/deposit`

- **Roles/purpose:** ADMIN; deposit simulated funds. Body
  `{requestId:string(1..64),amount:decimal-string>0}`.
- **Success:** 200 `{"accountId":"acc_1","requestId":"dep_1","amount":"10000.00"}`.
  Repeating `requestId` returns the original result.
- **Errors:** 400/401/403/404/409/429. **Idempotency/side effects:** writes
  one ledger entry per request ID. **Tier/week:** tier 3, Week 9;
  ADMIN-DEPOSIT.

#### POST `/admin/instruments`

- **Roles/purpose:** ADMIN; create an instrument. Body includes
  `{symbol,tickSize,lotSize,maxQuantity,maxPrice,protectionBandBps,referencePrice}`.
- **Success:** 201 instrument.
- **Errors:** 400/401/403/409/429. **Idempotency/side effects:** creates an
  active instrument. **Tier/week:** tier 3, Week 9; ADMIN-INSTRUMENTS.

#### PUT `/admin/instruments/{symbol}`

- **Roles/purpose:** ADMIN; update instrument configuration. Body uses the
  instrument fields; `referencePrice` is required on create.
- **Success:** 200 instrument.
- **Errors:** 400/401/403/404/409/429. **Idempotency/side effects:** audited
  configuration change. **Tier/week:** tier 3, Week 9; ADMIN-INSTRUMENTS.

#### POST `/admin/demo/reset`

- **Roles/purpose:** ADMIN; reset demo data. Demo profile only; returns 404
  outside the demo profile.
- **Success:** 202 `{"status":"RESET_REQUESTED"}`.
- **Errors:** 401/403/404/429. **Idempotency/side effects:** resets seeded
  users, accounts, orders, and projections. **Tier/week:** tier 3, Week 9;
  ADMIN-DEMO-RESET.

### System

All system endpoints require ADMIN. System dashboard work is Week 11; metrics
and `/health` are exposed on the separate metrics port where noted.

#### GET `/system/metrics/summary`

- **Success:** 200 `{"throughputPerSec":10,"latencyMs":{"p50":2,"p95":5,"p99":9},"queueDepth":0,"consumerLag":0,"eventLoopLagMs":1}`.
- **Errors:** 401/403/503. **Idempotency/side effects:** read-only.

#### GET `/system/shards`

- **Success:** 200 `{"items":[{"symbol":"ACME","ownerInstance":"shard-1","fencingEpoch":"7","lastJournalSeq":"42","lastSnapshotSeq":"40","lagMs":0}]}`.
- **Errors:** 401/403/503. **Idempotency/side effects:** read-only.

#### GET `/system/invariants`

- **Success:** 200 `{"items":[{"name":"ledger_debits_equal_credits","passed":true,"offendingRows":[]}]}`
- **Errors:** 401/403/503. **Idempotency/side effects:** read-only.

#### POST `/system/verify-replay`

- **Roles/purpose:** ADMIN; compare replay to live state. Body `{symbol:string}`.
- **Success:** 200 `{"equal":true,"diffSummary":null}`.
- **Errors:** 400/401/403/404/503/429. **Idempotency/side effects:** read-only
  verification.

#### POST `/system/simulator/start`

- **Roles/purpose:** ADMIN; start the market simulator. Body
  `{ratePerSec:int(1..5000),symbols:[string]}`.
- **Success:** 202 `{"status":"START_REQUESTED"}`.
- **Errors:** 400/401/403/409/429/503. **Idempotency/side effects:** starts
  generated order flow.

#### POST `/system/simulator/stop`

- **Roles/purpose:** ADMIN; stop the market simulator. No body.
- **Success:** 202 `{"status":"STOP_REQUESTED"}`.
- **Errors:** 401/403/409/429/503. **Idempotency/side effects:** stops
  generated order flow.

#### POST `/system/chaos/kill-shard`

- **Roles/purpose:** ADMIN; kill a shard in the demo profile only. Body
  `{symbol:string}`. Returns 404 outside the demo profile.
- **Success:** 202 `{"symbol":"ACME","status":"KILL_REQUESTED"}`.
- **Errors:** 400/401/403/404/429/503.

#### POST `/system/chaos/freeze-shard`

- **Roles/purpose:** ADMIN; freeze a shard in the demo profile only. Body
  `{symbol:string}`. Returns 404 outside the demo profile.
- **Success:** 202 `{"symbol":"ACME","status":"FREEZE_REQUESTED"}`.
- **Errors:** 400/401/403/404/429/503.

#### GET `/system/recovery`

- **Success:** 200 `{"lastRecoveryMs":120,"tailLength":"0"}`.
- **Errors:** 401/403/503. **Idempotency/side effects:** read-only.

## WebSocket `/ws`

The socket uses plain JSON and requires authentication before any subscription.
The client must send `{"op":"auth","token":"<jwt>"}` within 5 seconds. A bad,
missing, or late token closes the socket with code `4401`; successful auth
returns `{"type":"auth.ok","user":{...}}`.

After authentication, clients may send
`{"op":"subscribe","topic":"book.ACME"}` and
`{"op":"unsubscribe","topic":"book.ACME"}`. Unauthorized topics return
`{"type":"error","code":"FORBIDDEN","topic":"..."}`. Topics and audiences are:

| Topic | Audience |
| --- | --- |
| `book.{symbol}` | any authenticated role |
| `trades.{symbol}` | any authenticated role |
| `breaker` | any authenticated role |
| `user.orders` | the authenticated trader's own orders |
| `user.account` | the authenticated user's own account |
| `risk.rejections` | RISK |
| `system` | ADMIN |

Every server message uses `{type,seq,symbol?,ts,payload}`. `seq` is an integer
with no gaps per stream and `ts` is an ISO-8601 UTC timestamp. Payload schemas
are:

| Type | Payload |
| --- | --- |
| `book.snapshot` | `{seq,bids:[{price,quantity,cumulative}],asks:[{price,quantity,cumulative}],spread,lastPrice}` |
| `book.delta` | `{side:"BUY"|"SELL",price,quantity,action:"ADD"|"REMOVE"|"UPDATE"}` |
| `trade` | `{tradeId:"ACME-T1",price,quantity,ts,takerSide}` |
| `breaker.changed` | `{symbol,state,reason,incidentStartedAt,incidentElapsedMs,maxHaltDurationMs}` |
| `order.updated` | `{orderId,status,filledQuantity,remainingQuantity,rejectReason?}` |
| `account.updated` | `{total,held,available}` |
| `risk.rejection` | `{orderId,accountId,symbol,reason,needed,available,ts}` |
| `system.event` | `{name,status,detail}` |

The server pings every 15 seconds and closes clients that miss a pong. It
checks `bufferedAmount`; 1 MiB is the limit. Slow clients receive conflated
book updates, and a client that cannot be kept within the limit is closed with
code `4408`. On reconnect or any sequence gap, the client refetches the
relevant REST snapshot, discards stale deltas, then applies only deltas with
higher sequence numbers. The UI shows stale data until synchronization
completes. Async commands remain pending until their outcome event arrives.

## Role x endpoint matrix

`Y` means allowed, `N-403` means role mismatch, and `own-only-404` means a
trader may access only its own resource and receives 404 for another trader's
resource.

| Endpoint group | TRADER | RISK | OPS | ADMIN | public |
| --- | --- | --- | --- | --- | --- |
| Auth login/register | Y | Y | Y | Y | Y |
| Orders read | own-only-404 | Y | Y | Y | N-403 |
| Orders write | Y | N-403 | N-403 | N-403 | N-403 |
| Market data | Y | Y | Y | Y | N-403 |
| Accounts | own-only-404 | Y | Y | Y | N-403 |
| Risk | N-403 | Y | N-403 | Y | N-403 |
| Reconciliation | N-403 | N-403 | Y | Y | N-403 |
| Admin | N-403 | N-403 | N-403 | Y | N-403 |
| System | N-403 | N-403 | N-403 | Y | N-403 |
| WebSocket restricted topics | own-only-404 | Y | N-403 | Y | N-403 |

## Endpoint-to-page map

| Page | Endpoints |
| --- | --- |
| P0 home/auth | `/auth/login`, `/auth/register`, `/auth/refresh`, `/me` |
| P2 trading | `/orders`, `/orders/{id}`, `/symbols/{symbol}/book`, `/symbols/{symbol}/trades`, `/symbols/{symbol}/status`, `/instruments` |
| P3 portfolio | `/accounts/{id}/balances`, `/accounts/{id}/positions`, `/accounts/{id}/pnl`, `/accounts/{id}/reservations`, `/accounts/{id}/ledger` |
| P4 order detail | `/orders/{id}`, `/orders/{id}/events`, `DELETE /orders/{id}`, `PATCH /orders/{id}` |
| P5 risk | `/risk/accounts/{id}/limits`, `/risk/rejections`, `/risk/breakers`, `/risk/symbols/{symbol}/halt`, `/risk/symbols/{symbol}/resume`, `/risk/symbols/{symbol}/breaker-config` |
| P6 recon | `/recon/runs`, `/recon/runs/{id}`, `/recon/breaks`, `/recon/breaks/{id}`, `/recon/breaks/{id}/status`, `/recon/breaks/{id}/resolve`, `/recon/breaks/{id}/audit` |
| P7 system | `/system/metrics/summary`, `/system/shards`, `/system/invariants`, `/system/verify-replay`, `/system/simulator/start`, `/system/simulator/stop`, `/system/chaos/kill-shard`, `/system/chaos/freeze-shard`, `/system/recovery` |
| P8 admin | `/admin/users`, `/admin/accounts`, `/admin/accounts/{id}/deposit`, `/admin/instruments`, `/admin/instruments/{symbol}`, `/admin/demo/reset` |

## Endpoint-to-build-week map

| Area | API/UI week | Backend week |
| --- | --- | --- |
| Risk | Week 9 | Week 7 |
| Breaker and reconciliation | Week 9 | Week 8 |
| REST and WebSocket API | Week 9 | Week 9 |
| Kafka and fencing | Week 10 | Week 10 |
| System dashboard | Week 11 | Week 11 |
