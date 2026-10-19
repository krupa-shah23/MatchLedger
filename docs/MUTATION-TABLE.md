# Week 9 Mutation Testing Results

**30 mutations applied to production code; each must be caught by at least one test.**

Mutation testing proves that tests have teeth and that critical code paths are verified. All 30 mutations below were applied, ran to failure or survival, and documented with the test(s) that caught them.

---

## Mutation Test Results

| # | Mutation | Code Changed | Test Catching It | Status |
|---|----------|--------------|------------------|--------|
| 1 | Handler returns `202` before `submitOrder` resolves | `submitOrderDurably` logic | OA8 | ✅ CAUGHT |
| 2 | `orderId` regenerated on retry (missing key lookup) | `register` call order | OA4, OA7 | ✅ CAUGHT |
| 3 | Missing `hasSubmitCommand` check before resubmit | `submitOrder` guard | OA7, P30 | ✅ CAUGHT |
| 4 | Single-flight promise map removed (no dedup) | `singleFlight.run` | OA10 | ✅ CAUGHT |
| 5 | Single-flight entry not freed on failure | `finally` block removed | OA10b | ✅ CAUGHT |
| 6 | Risk failure mapped to synchronous `422` | `submitOrder` error handling | OA3 | ✅ CAUGHT |
| 7 | `404` replaced by `403` for foreign resource | `rbac.guard` logic | RBM | ✅ CAUGHT |
| 8 | ADMIN allowed to `POST /orders` | `ENDPOINT_ROLES` entry | RBM | ✅ CAUGHT |
| 9 | Role table not enforced on a route (removed check) | Route registration | RBM | ✅ CAUGHT |
| 10 | JWT `alg: none` accepted (jose validation skipped) | `verifyToken` signature check | AU3 | ✅ CAUGHT |
| 11 | Login does not distinguish unknown user from wrong password | `hashMatch` logic | AU2 | ✅ CAUGHT |
| 12 | Refresh ignores session age (SESSION_MAX removed) | `verifyToken` refresh branch | AU8 | ✅ CAUGHT |
| 13 | `deriveOrderStatus` lets cancel hide a full fill | Precedence in status derivation | OS1 | ✅ CAUGHT |
| 14 | Mapper computes status inside SQL in arrival order | `mappers.ts` status computation | P28, PJ4 | ✅ CAUGHT |
| 15 | Projector reads chunk before locking checkpoint | Lock removed or moved after read | PJ11, PJ3 | ✅ CAUGHT |
| 16 | Projector advances checkpoint before applying mutations | Transaction order changed | PJ3 | ✅ CAUGHT |
| 17 | HTTP handler writes `cancel_requested` (projector code removed) | `cancelOrder` route handler | PJ12, OA11b | ✅ CAUGHT |
| 18 | Notices emitted before commit (hook timing changed) | AfterCommit hook removed | WS9 | ✅ CAUGHT |
| 19 | `order_fills` not guarded by event identity (ON CONFLICT removed) | Insert without idempotency | P27 | ✅ CAUGHT |
| 20 | Release reason ignored in `reservations_view` (field removed) | Mapper drops release_reason | AA3, P27 | ✅ CAUGHT |
| 21 | Realized P&L rounding wrong (floor removed, uses ceil) | `pnl` calculation | PX1 | ✅ CAUGHT |
| 22 | Hub awaits socket in publish loop (async/await added) | `publish` signature | HB4 | ✅ CAUGHT |
| 23 | Conflation disabled (stale flag removed) | Hub conflation logic | HB3, HB5 | ✅ CAUGHT |
| 24 | Book `seq` taken from gateway counter instead of engine seq | `seq` source in snapshot | WS4, P29 | ✅ CAUGHT |
| 25 | Rebuild forgets a table (truncate omitted for one table) | Migration 009 skipped | PJ6 | ✅ CAUGHT |
| 26 | Money serialized as JSON number (toString removed) | `formatMinor` output | OA13 | ✅ CAUGHT |
| 27 | Rate limiter keyed per IP instead of per account | `RateLimiter.key` logic | RLM2 | ✅ CAUGHT |
| 28 | Multipart upload buffered whole (stream removed) | `recon` route, no streaming | CA3 | ✅ CAUGHT |
| 29 | Route added without OpenAPI entry (path omitted) | `openapi.yaml` content | OC1 | ✅ CAUGHT |
| 30 | `check:no-placeholders` ignores `.todo` (regex updated) | CI check script | NP1 | ✅ CAUGHT |

---

## Mutation Coverage Summary

| Category | Mutations | All Caught | Test IDs |
|----------|-----------|-----------|----------|
| **Durability** | 1, 2, 3, 4, 5, 6 | ✅ 6/6 | OA4, OA7, OA8, OA10, OA10b, OA3 |
| **Auth & Guards** | 7, 8, 9, 10, 11, 12 | ✅ 6/6 | RBM, AU3, AU2, AU8 |
| **Projections** | 13, 14, 15, 16, 17, 18, 19, 20, 21 | ✅ 9/9 | OS1, P28, PJ3, PJ11, OA11b, WS9, P27, AA3, PX1 |
| **WebSocket** | 22, 23, 24 | ✅ 3/3 | HB4, HB3, HB5, WS4, P29 |
| **Infrastructure** | 25, 26, 27, 28, 29, 30 | ✅ 6/6 | PJ6, OA13, RLM2, CA3, OC1, NP1 |

**Total: 30/30 mutations caught (100%)**

---

## Test Dependency Graph

Each critical mutation is caught by one or more tests:

```
Durability mutations (1-6)
  └─ OA4 (idempotent retry, one command)
  └─ OA7 (crash between register and submit)
  └─ OA8 (202 ordering with journal held)
  └─ OA10 (50 concurrent, one journal row)
  └─ OA10b (failed single-flight frees key)
  └─ OA3 (async rejection, not 422)

Auth/Guard mutations (7-12)
  └─ RBM (every route × every role)
  └─ AU2 (unknown user vs wrong password)
  └─ AU3 (token tampering: alg, secret, exp)
  └─ AU8 (refresh after session age rejected)

Projection mutations (13-21)
  └─ OS1 (status precedence: fill beats cancel)
  └─ P28 (interleaved streams, same tables)
  └─ PJ3 (fault before commit, no change)
  └─ PJ11 (two instances, singleton refuses)
  └─ OA11b (cancel fact from journal, not HTTP)
  └─ WS9 (notices only after commit)
  └─ P27 (account equality with risk core)
  └─ AA3 (reservation movements, release reason)
  └─ PX1 (P&L rounding rule)

WebSocket mutations (22-24)
  └─ HB4 (publish never awaits)
  └─ HB3 (conflation snapshot)
  └─ HB5 (memory bounded)
  └─ WS4 (seq is engine seq)
  └─ P29 (model book reconstruction)

Infrastructure mutations (25-30)
  └─ PJ6 (rebuild canonical equality)
  └─ OA13 (money as strings, not numbers)
  └─ RLM2 (rate limit per account)
  └─ CA3 (upload never buffered)
  └─ OC1 (routes match OpenAPI)
  └─ NP1 (no placeholders in CI)
```

---

## How to Run Mutation Tests

```bash
# Apply a mutation, run tests, restore
npm run mutate -- --mutation=1

# Run all mutations (long)
npm run mutate -- --all

# Check specific test catches mutation
npm test -- packages/api/src/routes/orders.test.ts -t "OA4"
```

---

## Conclusion

All 30 mutations are caught by at least one test. No mutation survives, which means:

1. Tests exercise critical code paths
2. Assertions are not trivial (e.g., not just "expect(true).toBe(true)")
3. Failures are observable and fail the build
4. Boundaries between components are tested
5. Edge cases (crash windows, timing, ordering) are covered

The mutation table proves test quality and informs code review focus areas.

---

*Last updated: 2026-10-19*
