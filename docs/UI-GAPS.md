# UI Gaps Analysis (1.3)

Week 11 sections 4.5 to 4.9 will require the following that does not exist yet:

## Analysis from OpenAPI + ENDPOINT_ROLES

### Endpoint Roles Present
- **TRADER**: /orders (POST, GET), /orders/{id} (GET, DELETE, PATCH), /auth endpoints
- **RISK**: Full order visibility, /risk endpoints  
- **OPS**: Order visibility, /system endpoints
- **ADMIN**: All endpoints
- **PUBLIC**: /auth/login, /auth/register (no-auth endpoints)

### Missing: PAGE_ROLES Derivation

The OpenAPI `x-roles` field specifies endpoint access control, but the UI needs **page-level roles** that determine:
1. Which routes are visible in navigation
2. Which routes are accessible (not-available page vs redirect to login)
3. Which UI components render per page (e.g., risk controls visible to RISK, not TRADER)

**Missing:** A `PAGE_ROLES` map derived from `ENDPOINT_ROLES` that associates:
- `/login` → PUBLIC (no auth required)
- `/register` → PUBLIC
- `/dashboard` → [TRADER, RISK, OPS, ADMIN]
- `/orders` → [TRADER, RISK, OPS, ADMIN]
- `/orders/{id}` → [TRADER, RISK, OPS, ADMIN]
- `/risk` → [RISK, ADMIN]
- `/system` → [OPS, ADMIN]
- `/admin` → [ADMIN]

## Schema Gaps (sections 4.5-4.9)

### 1. Zod Schemas for Request/Response Types
Missing client-side validation schemas:
- `LoginRequest`, `LoginResponse`, `RegisterRequest`, `RegisterResponse`
- `OrderRequest`, `OrderResponse`, `PaginatedOrders`
- `OrderEvents`, error shapes (ValidationError, Forbidden, NotFound, etc.)
- `Order`, `Instrument`, `Account`, `Risk` schemas
- Pagination shapes (Limit, Cursor, total, hasMore)
- Money codec round-trip (decimal string ↔ bigint internally)

**Why:** TypeScript safety + validation on client side before sending, on response before rendering

### 2. Config-Driven UI Flags
Missing environment-based configuration that the UI needs to read:
- `DEMO_PROFILE`: boolean flag that enables demo account/seed data routes (if not in production)
- `API_BASE_URL`: configurable API endpoint for different deployments
- `WS_URL`: WebSocket endpoint (separate from REST if needed)
- `APP_MODE`: "demo" | "production" for feature gates

**Why:** The login page needs to know whether to show "Demo Login" button, seed data generator, etc.

### 3. Authentication Context Gaps
Missing contract between API and AuthProvider:
- Token refresh strategy (when, how often, 401 retry)
- Token storage location (sessionStorage vs localStorage; the API spec is silent)
- Bearer token format in `Authorization: Bearer <token>`
- Logout trigger (explicit button vs token expiry)
- Remember-me / persistent login policy

**Where needed:** web/src/auth/AuthProvider, web/src/api/client

### 4. WebSocket Protocol for Real-Time Updates
The OpenAPI doesn't specify the `/ws` handshake or subscription messages. Missing:
- Subscription message format (e.g., `{ op: "subscribe", topics: ["orders", "market"] }`)
- Message format for order updates, market data, fills
- Backoff + reconnect strategy on disconnect
- Token auth on WS connection (currently happens via init message)

**Where needed:** web/src/hooks/useSocket (per WEEK-11 4.9)

### 5. Rate Limit Handling
OpenAPI specifies `429 Too Many Requests` with `Retry-After` header, but UI layer is missing:
- Client-side rate limit queue or request batching
- Exponential backoff display (e.g., "Retry in 5 seconds")
- User-visible notification for rate limits (not silent failure)

**Where needed:** web/src/api/client (per 1.7)

## Specific Missing Artifacts

### Config / Environment
- [ ] `web/public/config.json` or `web/.env.example` with API_BASE_URL, WS_URL, DEMO_PROFILE
- [ ] A way for the login page to read DEMO_PROFILE at runtime (fetch from `/api/v1/config`? or hardcoded env?)

### Type Definitions  
- [ ] `common/src/ui-schemas.ts`: Zod schemas for all request/response shapes (ZS6-ZS8 in 1.6)
- [ ] `common/src/ui-config.ts`: PAGE_ROLES derived from ENDPOINT_ROLES (via code generation or manual)

### API Client
- [ ] `web/src/api/client.ts`: Typed fetch wrapper with auth, error parsing, retry (UA1-UA4 in 1.7)
- [ ] `web/src/api/schema.ts`: Re-export Zod types from common

### Auth
- [ ] `web/src/auth/AuthProvider.tsx`: Token store, refresh timer, 401 retry (UG1-UG4 in 1.8)
- [ ] `web/src/auth/useAuth.ts`: Hook exposing user, token, login, logout, isLoading

### Utilities
- [ ] `web/src/utils/money.ts`: Re-export parse/format from common + bigint <-> decimal string (UZ1-UZ4 in 1.9)
- [ ] `web/src/utils/format.ts`: Currency, quantity, time formatting

### State Management
- [ ] `web/src/state/stream-state.ts`: Pure reducer for order/market/account state updates (hand-write, then US2-US5 tests in 1.10)
- [ ] `web/src/hooks/useSocket.ts`: WebSocket + reducer + TanStack Query refetch integration (US1, US6, US9 in 1.11)

### Routes & Guards
- [ ] `web/src/routes.ts`: PAGE_ROLES-based route definitions, not-available fallback page
- [ ] `web/src/PrivateRoute.tsx`: Route guard checking user role

### Pages (P1-P6)
- [ ] `web/src/pages/Login.tsx`: Show demo button if DEMO_PROFILE, call `/auth/login`
- [ ] `web/src/pages/Register.tsx`: Call `/auth/register`
- [ ] `web/src/pages/Dashboard.tsx`: Render per role (TRADER: your orders, RISK: all orders, OPS: system status, ADMIN: everything)
- [ ] `web/src/pages/Orders.tsx`: List, filter, paginate, TRADER can't see others' orders
- [ ] `web/src/pages/NotAvailable.tsx`: "You don't have access to this page" for wrong role
- [ ] `web/src/pages/OrderDetail.tsx`: View order, events, cancel/amend (TRADER only for own orders)

## Summary

**Config Gaps:**
- DEMO_PROFILE, API_BASE_URL, WS_URL not exposed to client

**Type Gaps:**
- Zod schemas for all API request/response types missing

**Auth Gaps:**
- Token refresh strategy not documented
- sessionStorage vs localStorage not decided
- 401 → retry → logout not implemented

**WebSocket Gaps:**
- Subscription protocol not specified
- Reconnect + backoff not defined

**Component Gaps:**
- Route guards (not-available page, redirect to login) not wired
- PAGE_ROLES not derivable from ENDPOINT_ROLES without manual work

These gaps block the UI from tier 1 completion (P1-P6) and should be addressed in WEEK-11 sections 4.5-4.9.
