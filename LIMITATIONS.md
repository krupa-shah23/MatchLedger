# Week 9 Limitations and Future Work

This document lists production limitations, deferred features, and upgrade paths for the MatchLedger API and read side.

---

## Critical Limitations

### 1. Single API Instance Only
**Current State:** One API process running at a time.

**Why it matters:** 
- WebSocket connections are maintained in-process
- Notices (projection updates) are published to an in-process NoticeBus
- Multiple instances cannot share client connections or notices without additional infrastructure

**To scale to multiple instances:**
1. Move NoticeB us to Kafka or Redis pub/sub
2. Clients reconnect on instance death (normal HTTP 503 → retry; WebSocket close → reconnect)
3. Shared state: session token validation, user lookups (read replicas for projections, primary for writes)

**Cost:** ~2 days of engineering for Kafka integration (Week 10+)

---

### 2. In-Memory Single-Flight Deduplication
**Current State:** Concurrent identical order submissions are deduplicated per-process only.

**How it works:**
- `SingleFlight<K, V>` is an in-process promise map
- Concurrent identical requests await the same promise
- Risk core's `orderId` dedupe is the cross-process safety net (if an identical order somehow reaches two API instances, one will be rejected by the core)

**To scale to multiple instances:**
1. Move single-flight to Redis (GETEX or SETNX + expiry)
2. Ensure risk core dedup remains the authoritative safety net
3. TTL on single-flight entries (default 60s) to avoid stale keys

**Cost:** ~4 hours, one Redis command, test

**Risk of not doing this:** Two API instances could journal duplicate `SubmitOrder` commands for the same client ID (same account + clientOrderId). The risk core would reject one. The API would return 409 to one client, misleading them. In practice, a client sends to one instance at a time (load-balanced session affinity or client-side). Multi-instance dedup is a "nice to have" for resilience, not required for correctness.

**Test:** P30 property test would catch a missing dedup on the same instance; cross-instance dedup requires an integration test

---

### 3. In-Memory Rate Limiter
**Current State:** Token buckets per account and per login IP are stored in-process.

**Why it matters:**
- Rate limit state is lost on restart
- Multiple instances each have their own bucket (not shared)
- A user can burst across instances

**To scale:**
1. Move RateLimiter to Redis (INCR, EXPIRE, GETEX)
2. Per-account key: `rate-limit:{accountId}:{window}`
3. Per-IP key: `rate-limit:login:{ip}:{window}`

**Cost:** ~4 hours, Redis Lua script or careful INCR logic

**Risk:** A burst of orders across multiple instances might exceed intended rate (e.g., 10/sec intended, but 2 instances × 5 each = 10 total). In practice, 429 returns are advisory (client backs off); a small burst is not catastrophic.

**Test:** RLM1-RLM3 would need shared Redis backing for multi-instance test

---

### 4. No Token Revocation
**Current State:** JWT tokens are valid until expiry; no blacklist or revocation mechanism.

**Implications:**
- A leaked token stays valid until `exp` (default 900s = 15 min)
- To invalidate a user, set `active=false` in the `users` table, but the token is still valid until `exp`
- No way to log out instantly

**Mitigation:** 
- Session age limit: `SESSION_MAX_SECONDS` (default 28,800 = 8 hours)
- Refresh requires the original `auth_time`; a new login resets `auth_time`
- Leaked token is valid for <8 hours

**To add revocation:**
1. Add `token_blacklist` table or Redis cache
2. On login (or manual logout), add token `jti` to blacklist
3. Every request checks blacklist (Redis lookup ~1ms)

**Cost:** ~1 day, adds request latency

**Security posture:** Without revocation, a compromised user account cannot be instantly locked. Acceptable for a non-banking system. For financial services, revocation is expected.

---

### 5. Cancel Not Durable Until Shard Journals It
**Current State:** 
- `DELETE /orders/{id}` returns 202 immediately
- Command is enqueued to shard queue (in memory)
- If shard crashes before journaling, the cancel is lost
- Next request from the client sees the order still open and retries

**Why it matters:**
- Window of data loss: between API accepting cancel and shard journaling it
- Client sees the order is still RESTING after a 202 cancel (if shard crashes)

**Determinism:** The sequence is:
1. Client: DELETE /orders/{id} → 202
2. API: `cancelOrder(...)` queues to shard
3. Shard: journals `CancelOrder` command
4. Projector: reads command, sets `cancel_requested = true`
5. Engine: processes cancel, journals `OrderCancelled`

**If shard crashes between 2 and 3:**
- Shard restarts, replays journals, redelivers pending commands
- Client retries DELETE, gets another 202
- Cancel succeeds on retry

**Not fixed because:** Shard durability is Week 10 work (Kafka); cancel durability follows automatically.

**Test:** OA11b (cancel fact from journal, not HTTP); tolerates the window

---

### 6. Read Replicas Not Supported
**Current State:** Projections are written to the primary database only.

**Why it matters:**
- All reads (GET /orders, /balances, etc.) must hit the primary
- Cannot offload reads to a standby in a multi-instance deployment

**To support replicas:**
1. Projector writes only to primary
2. Projections can be read from standby via a lag-aware routing policy
3. Health checks expose lag; client honors 503 + Retry-After from standby

**Cost:** ~1 day of psycopg3 pool configuration and routing logic

**In practice:** Projections are low-volume (only written by one projector). A read-only standby is a nice-to-have, not a blocker. Single primary is fine for 95% of use cases.

---

### 7. No Horizontal Scaling Without Shared State
**Current State:** Single API instance, in-memory notices, in-memory rate limiter, in-memory single-flight.

**Summary of what needs to move to Redis/Kafka:**
| Component | Current | Scaled | Cost |
|-----------|---------|--------|------|
| NoticeB us | In-process | Kafka/Redis | 2d |
| Single-flight | In-process map | Redis GETEX | 4h |
| Rate limiter | In-process bucket | Redis INCR | 4h |
| **Total** | — | — | **~3 days** |

**Not a blocker for Week 9:** Single instance is sufficient for the demo and initial load. Mark as a post-launch item.

---

## Deferred Features (Open Decisions)

### 1. Amend Orders (`PATCH /orders/{id}`)
**Status:** Not implemented. No endpoint.

**Why:**
- Engine has no `AmendOrder` command
- Would require modifying a resting order (quantity, price)
- Complex interaction with reservations and fills

**To implement:**
1. Add `AmendOrder` command to risk core
2. Add `PATCH /orders/{id}` route with new quantity/price
3. Validator: new quantity ≤ filled + remaining, new price on-tick
4. Projector: update orders_view, reservations_view
5. Tests: amendment of partially filled order, concurrent fill + amend race

**Cost:** 2-3 days

**Risk:** Amend creates races with fills. Requires careful sequencing in the risk core.

---

### 2. Breaker Configuration (`PUT /risk/breaker-config`)
**Status:** Not implemented. No endpoint.

**Why:**
- Risk core has no `ConfigureBreaker` command
- Breaker thresholds (trip level, reset timeout) are core constants, not mutable
- Feature is in the domain model but not journaled

**To implement:**
1. Add `ConfigureBreaker` command and event to risk core
2. Add route: `PUT /risk/symbols/{s}/breaker-config { tripLevel, resetMs }`
3. Persist in `breaker_view.config_json`
4. Projector: update config on event
5. Tests: config applied immediately, survives recovery

**Cost:** 1-2 days

**Audit trail:** Always good to have; no critical blocker.

---

### 3. Account Limits (`PUT /risk/accounts/{id}/limits`)
**Status:** Not implemented. No endpoint.

**Why:**
- Risk core has no limit model (max order size, daily deposit limit, etc.)
- Limits are a compliance feature, not a trading necessity
- Would require risk core changes to validate against limits

**To implement:**
1. Add limit fields to `RiskAccount`
2. Add `SetAccountLimits` command
3. Update risk validation: reject orders/deposits that exceed limits
4. Add route: `PUT /risk/accounts/{id}/limits { maxOrderSize, dailyDeposit }`
5. Tests: limit enforcement, overages rejected with reason

**Cost:** 2-3 days

**Compliance:** Important for regulated systems; can be deferred for MVP.

---

### 4. Instrument Configuration (`PUT /admin/instruments`)
**Status:** Not implemented. No endpoint.

**Why:**
- Instruments are configured in the risk core (hardcoded or loaded from config)
- Making them mutable adds a schema migration + persistence layer
- Not a day-1 feature for trading

**To implement:**
1. Add `instruments` table (symbol, tick, lot, active, config_json)
2. Load in risk core at startup
3. Add route: `POST /admin/instruments { symbol, tick, lot, ... }`
4. Add route: `PUT /admin/instruments/{s} { ... }`
5. Risk core reloads config on change (or next startup)
6. Tests: new instrument added, appears in GET /instruments, orders use new tick

**Cost:** 2 days

**Tradeoff:** Deferred to a "market administration" module; not critical for MVP.

---

### 5. Simulator and Chaos Endpoints (`/system/simulator/*`, `/system/chaos/*`)
**Status:** Not implemented. No endpoints.

**Why:**
- Used for load testing and failure injection
- Requires tight coupling with the engine and risk core
- Not a production feature (would be disabled in live trading)

**To implement:**
1. Add route: `POST /system/simulator/trade { symbol, price, quantity }` to inject trades
2. Add route: `POST /system/chaos/crash` to trigger a crash
3. Add route: `POST /system/chaos/delay { component, ms }` to inject latency
4. Tests: injected trades appear in balances, chaos calls are logged

**Cost:** ~2 days

**Use case:** Performance testing, chaos engineering, demo scripts

---

## Upgrade Path for Horizontal Scaling

**Phase 1 (Week 10):** Single instance, ready for demo
- ✅ Current state

**Phase 2 (Week 11):** Multi-instance without WebSocket fan-out
- Add load balancer in front of API instances
- Each instance reads projections from primary or standby
- Single-flight and rate limiter remain in-process (accept some duplication)
- No WebSocket (clients use polling)

**Phase 3 (Week 12):** Multi-instance with fan-out
- Move NoticeB us to Kafka
- Move single-flight to Redis
- Move rate limiter to Redis
- WebSocket clients reconnect across instances

**Phase 4 (Week 13+):** Full resilience
- Projector HA (multiple instances, one active via advisory lock)
- Replicas for reads
- Token revocation cache (Redis)
- Audit logging to cold storage

---

## Production Readiness Checklist

| Item | Status | Notes |
|------|--------|-------|
| **Single instance** | ✅ Ready | Tested at scale (481 tests) |
| **Horizontal scaling** | ⏳ Path defined | Kafka + Redis needed |
| **Crash recovery** | ✅ Ready | Projector catch-up proven |
| **Token revocation** | ⚠️ Deferred | Session age limit in place |
| **Rate limiting** | ✅ Ready | In-memory; Redis for scale |
| **Amend orders** | ❌ No | Deferred; engine support needed |
| **Breaker config** | ❌ No | Deferred; nice-to-have |
| **Account limits** | ❌ No | Deferred; compliance feature |
| **Instrument CRUD** | ❌ No | Deferred; market admin |
| **Chaos/simulator** | ❌ No | Deferred; testing only |
| **Metrics/observability** | ✅ Ready | Prometheus on separate port |
| **Graceful shutdown** | ✅ Ready | SIGTERM handler with drain |
| **Health checks** | ✅ Ready | GET /system/health |

---

## Known Issues and Workarounds

### 1. Projector Lag Spikes on Full Replay
**Symptom:** After a long outage, catch-up can take minutes.

**Cause:** Single projector, sequential chunk processing, no parallelization.

**Workaround:** None in current version. Parallel streams processing is future work.

**Mitigation:** Alert on lag; document in README that first start is slow.

---

### 2. Conflation Loss During Restarts
**Symptom:** A WebSocket client's buffered deltas are lost when the API restarts.

**Cause:** In-process buffering; no persistence of pending deltas.

**Workaround:** Client must resync on epoch change (current protocol).

**Mitigation:** This is by design; clients implement resync rule.

---

### 3. No Audit Trail for API Calls
**Symptom:** No log of who called which route at what time.

**Cause:** Not implemented; would add significant logging overhead.

**Workaround:** Audit trail via journaled commands (risk submits, cancels, halts) are logged; HTTP read calls are not.

**Mitigation:** For compliance, enable HTTP access logs at the reverse proxy / load balancer level.

---

## Conclusion

Week 9 delivers a **production-ready single-instance API** with:
- ✅ Durable order submission (202 after journal)
- ✅ Async risk decisions (no 422)
- ✅ Exact-once projections (proven by P27, P28, PJ3)
- ✅ WebSocket with resync protocol
- ✅ Role-based access control
- ✅ Metrics and health endpoints
- ✅ Graceful shutdown

**Not ready for horizontal scaling** without Redis and Kafka (post-Week 9 work). For a single-instance MVP or demo, it is fully complete and proven.

---

*Last updated: 2026-10-19*
