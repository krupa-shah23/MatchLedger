# Week 9 Implementation Audit: Real vs Stubs

**Overall Assessment**: ~40% implemented, 60% stubs

This is a detailed audit of what is actually working code vs placeholder stubs.

---

## ✅ FULLY IMPLEMENTED (Ready to test)

### Projections Layer

| Component | File | Status | Details |
|-----------|------|--------|---------|
| `deriveOrderStatus()` | order-facts.ts | ✅ Complete | Pure function, correct precedence, validates impossible states |
| Mapper: Risk records | mappers.ts | ✅ Complete | SubmitOrder, CancelOrder, ReservationPlaced/Converted/Released, OrderAccepted/Rejected, FundsDeposited |
| Mapper: Engine records | mappers.ts | ✅ Complete | OrderRested, TradeExecuted, OrderCancelled, OrderRejected |
| Mutation types | mappers.ts | ✅ Complete | 13 mutation variants for all table operations |
| Checkpoint fetch/advance | checkpoints.ts | ✅ Complete | FOR UPDATE locking, insert at 0, advance with timestamp |
| Queries: single order | queries.ts | ✅ Complete | getOrder(id) |
| Queries: list orders | queries.ts | ✅ Complete | listOrders() with cursor pagination |
| Queries: order timeline | queries.ts | ✅ Complete | getOrderTimeline() merging risk and engine events |
| Queries: book | queries.ts | ✅ Complete | getBook(symbol) with bid/ask levels |
| Queries: other reads | queries.ts | ✅ Complete | getTrades, getBalances, getPositions, getPnl, getReservations |

### API Infrastructure

| Component | File | Status | Details |
|-----------|------|--------|---------|
| Config parsing | config.ts | ✅ Complete | Zod schema with fail-fast, all env vars validated |
| Password hashing | auth/passwords.ts | ✅ Complete | Scrypt N=16384, salt in hash, verifyPassword with timingSafeEqual |
| JWT tokens | auth/tokens.ts | ✅ Complete | HS256 via jose, claims, expiry, alg none rejection |
| User queries | auth/users.ts | ✅ Complete | getUserByUsername, getUserById, getUserAccounts, userOwnsAccount |
| Single-flight | orders/single-flight.ts | ✅ Complete | Key-based promise coalescing, removes on settle |
| submitOrderDurably() | orders/submit.ts | ✅ Complete | Register, conflict detection, hasSubmitCommand check, await journal |
| Rate limiter | plugins/rate-limit.ts | ✅ Complete | Token bucket, per-key, injected time, Retry-After rounding |
| Error handling | plugins/errors.ts | ✅ Complete | RFC 9457 builder, ProblemCode union, no stack traces in 5xx |
| WebSocket Hub | ws/hub.ts | ✅ 80% Complete | Subscribe/unsubscribe, watermarks (HIGH/LOW/HARD), buffering, epoch generation |
| | | | ❌ Snapshot sending on drain not implemented (TODO) |
| | | | ❌ Conflation snapshot with `conflated: true` not built |
| App factory | app.ts | ✅ Complete | Registers all plugins and routes |
| Main composition | main.ts | ✅ Skeleton | Has structure, marked with TODO for implementation |

### Migrations

| Migration | File | Status | Details |
|-----------|------|--------|---------|
| 008_users.sql | migrations/ | ✅ Complete | users table with scrypt hash, role, user_accounts link |
| 009_projection_core.sql | migrations/ | ✅ Complete | orders_view, order_fills, resting_orders, trades_view, checkspoints |
| 010_account_views.sql | migrations/ | ✅ Complete | balances_view, positions_view, reservations_view, rejections_view, breaker_view |
| 011_api_support.sql | migrations/ | ✅ Complete | ALTER order_requests to add columns |

---

## ⚠️ PARTIALLY IMPLEMENTED (Skeleton with TODOs)

### Projector

| Component | File | Status | Details |
|-----------|------|--------|---------|
| Projector.runOnce() | projector.ts | ⚠️ 70% | Locks checkpoint, reads chunk, but applies mutations marked TODO |
| Projector.start() | projector.ts | ✅ 90% | Advisory lock working, _poll() scheduled |
| Projector._poll() | projector.ts | ⚠️ 30% | Has timer, but TODO: poll all streams per loop |
| Projector.rebuild() | projector.ts | ⚠️ 60% | Truncates tables, but TODO: reapply mutations from journal |
| Projector.wake() | projector.ts | ❌ 0% | Stub only, marked TODO |
| Notices | notices.ts | ✅ Complete | NoticeBus with subscribe/publish |

**Missing in Projector**:
- Actual mutation application (runOnce applies mutations in TODO)
- Rebuilding logic (replay from journals)
- Polling all streams (currently only default symbol)
- Wake signal handling

### WebSocket Gateway

| Component | File | Status | Details |
|-----------|------|--------|---------|
| WebSocket route | ws/gateway.ts | ❌ 0% | Stub only |
| Auth timer | ws/gateway.ts | ❌ 0% | Not implemented |
| Subscribe handling | ws/gateway.ts | ❌ 0% | Not implemented |
| Role checks per topic | ws/gateway.ts | ❌ 0% | Not implemented |
| Snapshot delivery | ws/gateway.ts | ❌ 0% | Not implemented |
| Delta delivery | ws/gateway.ts | ❌ 0% | Not implemented |

---

## ❌ STUBS ONLY (No implementation)

### HTTP Route Handlers (25 routes)

| Route | File | Status |
|-------|------|--------|
| POST /orders | orders.ts | ❌ Stub |
| GET /orders/{id} | orders.ts | ❌ Stub |
| GET /orders | orders.ts | ❌ Stub |
| DELETE /orders/{id} | orders.ts | ❌ Stub |
| GET /orders/{id}/events | orders.ts | ❌ Stub |
| GET /instruments | market.ts | ❌ Stub |
| GET /instruments/{symbol} | market.ts | ❌ Stub |
| GET /symbols/{symbol}/book | market.ts | ❌ Stub |
| GET /trades | market.ts | ❌ Stub |
| GET /status | market.ts | ❌ Stub |
| GET /accounts/{id}/balances | accounts.ts | ❌ Stub |
| GET /accounts/{id}/positions | accounts.ts | ❌ Stub |
| GET /accounts/{id}/pnl | accounts.ts | ❌ Stub |
| GET /accounts/{id}/reservations | accounts.ts | ❌ Stub |
| GET /accounts/{id}/ledger | accounts.ts | ❌ Stub |
| POST /risk/symbols/{symbol}/halt | risk.ts | ❌ Stub |
| POST /risk/symbols/{symbol}/resume | risk.ts | ❌ Stub |
| GET /risk/rejections | risk.ts | ❌ Stub |
| GET /risk/breakers | risk.ts | ❌ Stub |
| POST /recon/runs | recon.ts | ❌ Stub |
| GET /recon/runs | recon.ts | ❌ Stub |
| GET /recon/runs/{id} | recon.ts | ❌ Stub |
| GET /recon/breaks | recon.ts | ❌ Stub |
| GET /recon/breaks/{id} | recon.ts | ❌ Stub |
| POST /recon/breaks/{id}/status | recon.ts | ❌ Stub |
| POST /recon/breaks/{id}/resolve | recon.ts | ❌ Stub |
| GET /recon/breaks/{id}/audit | recon.ts | ❌ Stub |
| GET /admin/users | admin.ts | ❌ Stub |
| POST /admin/users | admin.ts | ❌ Stub |
| GET /admin/accounts | admin.ts | ❌ Stub |
| POST /admin/accounts | admin.ts | ❌ Stub |
| POST /admin/accounts/{id}/deposit | admin.ts | ❌ Stub |
| GET /system/invariants | system.ts | ❌ Stub |
| GET /system/health | system.ts | ❌ Stub |

### Auth Routes (3 routes)

| Route | File | Status |
|-------|------|--------|
| POST /auth/login | auth.ts | ❌ Stub |
| POST /auth/refresh | auth.ts | ❌ Stub |
| GET /me | auth.ts | ❌ Stub |

### Missing Core Implementations

| Component | Why needed | Status |
|-----------|-----------|--------|
| RBAC enforcement | Guards on routes | ❌ Not in routes |
| Ownership checks | Per-request account lookup | ❌ Not in routes |
| Rate limiting middleware | Applied to routes | ❌ Not applied |
| JWT verification middleware | Auth check | ❌ Not in routes |
| Request ID injection | Response headers | ❌ Not added |
| Zod validation middleware | Body/query validation | ❌ Not applied |
| Admin/system endpoints | User/account/system operations | ⚠️ Stubs exist |
| WebSocket gateway | Real `/ws` route | ❌ Not implemented |
| Metrics server | Separate port | ❌ Not implemented |
| Scripts | seed-demo.mjs, rebuild-projections.mjs | ⚠️ Skeleton stubs |

---

## 📊 Summary by Category

### Projections (read side)
- **Facts & Status**: ✅ Complete (deriveOrderStatus)
- **Mapping**: ✅ Complete (both risk and engine)
- **Storage**: ✅ Migrations done
- **Projection**: ⚠️ 70% (missing mutation application, rebuild, polling streams)
- **Queries**: ✅ Complete

### API Infrastructure
- **Config**: ✅ Complete
- **Auth (passwords, JWT)**: ✅ Complete
- **Error handling**: ✅ Complete
- **Rate limiting**: ✅ Complete
- **Single-flight**: ✅ Complete
- **submitOrderDurably**: ✅ Complete
- **User queries**: ✅ Complete

### HTTP Routes
- **Stubs**: ❌ 38 routes (no handlers, no validation, no guards, no db queries)
- **Middleware**: ❌ Not wired (auth, rbac, rate limit, validation, errors)
- **Response serialization**: ❌ Money/quantities as strings not enforced

### WebSocket
- **Hub**: ✅ 80% (missing snapshot sending on drain)
- **Gateway**: ❌ Not implemented (0%)
- **Integration with projections**: ❌ No notice subscription

### Tests
- **Infrastructure tests**: ✅ 362+ passing
- **Route tests**: ❌ 39 stubs (no real assertions)
- **WebSocket tests**: ❌ 16 stubs
- **E2E tests**: ❌ 2 stubs
- **Contract tests**: ❌ 2 stubs

---

## 🚀 What You Can Actually Do Right Now

1. **Test the projection layer** (deriveOrderStatus, mappers, queries)
   - Inject journal records, verify tables are built correctly
   - Run P27, P28 (property tests comparing projections with risk core)
   - Rebuild and verify identical reconstruction

2. **Test auth**
   - Password hashing and verification (AU3)
   - JWT token generation and verification (AU4)
   - Login rate limiting per IP and username

3. **Test single-flight and submitOrderDurably**
   - Register, conflict detection, hasSubmitCommand check
   - Concurrent identical requests coalesce to one execution
   - Crash between register and submit handled on retry

4. **Test rate limiter**
   - Token bucket with injected time
   - Retry-After calculation

---

## ⚠️ Critical Gaps to Close for a Working API

### Tier 1: Make routes return real data (Blocking everything)

1. **POST /orders**
   - Add Zod validation for PlaceOrderBody
   - Call submitOrderDurably
   - Add rate limiting per account
   - Return 202 after journal append
   - Handle CONFLICT_DIFFERENT_PAYLOAD → 409

2. **GET /orders/{id}**
   - Synthesize RECEIVED from order_requests if no view row
   - Deserialize money/quantities as strings
   - Check ownership (404 for others)

3. **GET /orders** with cursor pagination
   - Require accountId for RISK/OPS/ADMIN
   - Filter by status, symbol, dates
   - Return next cursor

4. **DELETE /orders/{id}**
   - Check ownership
   - Check terminal status → 409
   - Call runtime.cancelOrder
   - Return 202

5. **GET /orders/{id}/events**
   - Merge risk and engine records (4 stage ranks)
   - Add explanation sentence to rejections (snapshot comparison)

### Tier 2: Route skeleton for all 38 routes

- Market data (GET /instruments, book, trades, status)
- Accounts (balances, positions, pnl, reservations, ledger)
- Risk (halt, resume, rejections, breakers)
- Recon (upload, list, status, resolve)
- Admin (users, accounts, deposit)
- System (invariants, health)

Each needs:
- Zod validation
- RBAC guard (403 or 404)
- Ownership check (404 for others)
- Database query (mostly via projections)
- Money/quantities as strings in response

### Tier 3: WebSocket gateway

- GET /ws with @fastify/websocket
- Auth message within 5 seconds
- Subscribe/unsubscribe with role check per topic
- Send initial snapshot
- Listen to NoticeBus and send deltas
- Handle slow clients: conflate books, queue/close others
- Keep-alive ping/pong

### Tier 4: Projector completion

- Mutation application in runOnce()
- Rebuild: replay all journals
- Wake signal from journal append
- Poll all streams per cycle (not just default)

### Tier 5: Polish

- Metrics server on separate port
- Health checks and invariants
- OpenAPI contract test (OC1, OC2)
- E2E tests with real Postgres
- Scripts (seed-demo, rebuild-projections)

---

## 📈 Test Coverage

| Category | Total | Passing | Stubs | % Coverage |
|----------|-------|---------|-------|-----------|
| Infrastructure | 362+ | 362+ | 0 | ✅ 100% |
| Projections | 30 | 30 | 0 | ✅ 100% |
| Auth | 8 | 8 | 0 | ✅ 100% |
| Rate limiting | 3 | 3 | 0 | ✅ 100% |
| Single-flight | 2 | 2 | 0 | ✅ 100% |
| **Routes** | **39** | **0** | **39** | ❌ 0% |
| **WebSocket** | **16** | **0** | **16** | ❌ 0% |
| **Contracts** | **22+** | **0** | **22+** | ❌ 0% |
| **E2E** | **2** | **0** | **2** | ❌ 0% |
| **TOTAL** | **481** | **405** | **76** | ⚠️ 84% |

---

## 🎯 Recommendation

**Current state is a solid foundation but incomplete.** You have:
- ✅ All infrastructure (config, auth, errors, rate limit, single-flight)
- ✅ Complete projection layer (status derivation, mappers, queries)
- ✅ Durable order submission (submitOrderDurably)
- ✅ WebSocket hub (watermarks, conflation ready)

**Missing is the HTTP API layer:**
- ❌ 38 route handlers (mostly CRUD wiring)
- ❌ Request/response handling (validation, guards, serialization)
- ❌ WebSocket gateway integration
- ❌ Projector mutation application
- ❌ Real test assertions (80+ tests are stubs)

**Effort to complete (~16-20 hours):**
1. Routes (5-6 hours): POST /orders, GET /orders/{id}, GET /orders, DELETE, + market + accounts + risk + recon + admin + system
2. WebSocket gateway (3-4 hours): @fastify/websocket, auth timer, subscribe, snapshot, deltas, slow-client policy
3. Projector completion (2-3 hours): mutation application, rebuild, polling
4. Test assertions (4-5 hours): replace 80+ stubs with real assertions
5. E2E and contracts (2-3 hours): real Postgres tests, OpenAPI validation

**Suggestion**: Finish Tier 1 routes (POST, GET, DELETE /orders) end-to-end with real tests (3-4 hours), then assess remaining work. That unblocks trading and most other features.

---

**Generated**: 2026-10-19  
**Audit by**: Manual code inspection + test coverage analysis  
**Scope**: All 481 tests, 38 routes, 9 key modules
