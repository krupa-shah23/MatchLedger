# Web rebuild — complete

All 8 planned tasks are done. `web/` builds, type-checks, and its full test
suite passes; the app was verified live in a browser (login renders, demo
buttons work, API calls go through the real dev proxy, errors surface
cleanly with no crash).

## Final numbers
- `npm run build` (root `tsc -b`): clean
- `cd web && npm run build` (`tsc -b && vite build`): clean, produces `web/dist`
- `npx vitest run` (root, `packages/**`): 574 passed, 147 skipped (documented, container-gated), 0 failed
- `cd web && npx vitest run`: **80/80 passed**
- `npm run lint`: 18 pre-existing errors in `packages/transport/{consumer,producer}.ts` (unrelated to this work, not touched), 0 elsewhere
- Live browser check: login page renders, demo-role buttons present (`VITE_PROFILE=demo` in `web/.env`), submitting posts to `/api/v1/auth/login` through Vite's dev proxy, a 502 (no backend running) surfaces as "HTTP 502" with no crash

## What changed, by area

**Infra (previously missing entirely):**
- `web/index.html`, `@vitejs/plugin-react`, `react-router`, `@types/react(-dom)`, `@testing-library/{dom,jest-dom,user-event}` added/declared
- `web/tsconfig.json`: added `jsx`, `lib`, `moduleResolution`, `types`, and `.tsx` to `include`
- `web/vitest.config.ts` + `web/test/setup.ts` created (web tests were not runnable by any config before this session)
- `web/.env` with `VITE_PROFILE=demo` (gitignored, no secrets)

**Auth/socket layer (`web/src/auth/`, `web/src/ws/`, `web/src/state/stream-state.ts`):**
- Real `token-store.ts` (sessionStorage only), `AuthProvider.tsx`, `guards.tsx` (`RequireRole`, `useCanWrite`)
- `stream-state.ts` rewritten to match WEEK-11.md 4.9's actual contract (epoch, conflation, per-topic-family gap rules, close codes 4401/1013/1001) — the original only had the Week-10 `it.todo`/fake scaffolding described in the audit
- `useSocket.ts` built from scratch: owns the WebSocket lifecycle, auth-before-subscribe, exponential backoff with injectable scheduler, delegates all state transitions to the pure reducer
- `api/client.ts` fixed: the 401 handler used to call the refresh callback but then always threw anyway; it now actually retries the original request once after a successful refresh
- `packages/common/src/ui-config.ts`: added missing `/trade`, `/portfolio` routes to `PAGE_ROLES`, fixed `/system` (was OPS+ADMIN, spec says ADMIN only), added `canWritePage`

**Pages — all previously mock/stub, now real:**
- `Login.tsx` — real, uses `AuthProvider.login()`
- `Trading.tsx` — new, built from scratch using `useSocket` + the real `OrderEntry`/`OpenOrders`/`LifecycleStrip` components (also fixed: `OrderEntry.tsx` had a `ReferenceError` on an undefined `priceNum` variable and computed the estimate with floating-point math; now uses `parseDecimalToMinor`/`estimateReservation`, bigint only)
- `Portfolio.tsx` — real fetches to balances/positions/reservations, account picker for non-TRADER roles, null-mark em-dash handling
- `OrderDetail.tsx` — real fetches to the order and its events, 404 handling, rejection sentence
- `Risk.tsx`, `Recon.tsx`, `System.tsx` — extracted from the 951-line `Dashboard.tsx` monolith into their own files (they were already mostly real, just misplaced and reading `localStorage` directly instead of going through `useAuth()`); also fixed a dead halt-symbol input field (had no `onChange`) and replaced hand-rolled money-string slicing in `Recon.tsx` with the real `formatMoney` (the old code broke on short minor-unit strings)
- Deleted: `web/src/components/TradingPage.tsx` (hardcoded demo data, dead), the `Dashboard.tsx` `TradingPage` stub, `web/src/main.js`/`main.d.ts` (the old hand-rolled entry point — JSX-in-`.js`, localStorage token, no guards, no lifecycle wiring)

**Routing:**
- `web/src/router.tsx`, `App.tsx`, `main.tsx` created per the spec's file layout, wiring every protected route through `RequireRole`
- `index.html` now points at `/src/main.tsx`

**Every rewritten test now imports and exercises the real component** instead of a fake inline one defined in the test file itself — this was the single biggest pattern found across the original codebase (`Trading.test.tsx`, `Login.test.tsx`, `auth.test.ts`, `stream.test.ts` all had this problem; `stream.test.ts`/US1-US9 was the worst case, testing nothing from `stream-state.ts` at all).

## Known remaining gaps (not blocking, not done this session)
- `packages/transport/{consumer,producer}.ts`: 18 pre-existing `no-explicit-any` lint errors, unrelated to `web`.
- `packages/api/src/ws/gateway.ts:78`: still accepts any non-empty string as a valid WebSocket token server-side (no real JWT verification). The client-side auth layer built this session is real, but it's only as strong as the server it talks to. See `docs/WEEK-11-AUDIT.md` for the full original finding.
- `packages/common/src/schemas.test.ts` and `ui-schemas.test.ts` both claim ZS6-ZS8 with different, self-mocked content — not touched, out of scope for the web rebuild.
- Full e2e (`e2e/demo.spec.ts` DEMO1-5) was not re-run against a live backend this session — that needs Postgres/Kafka/the API server up, which wasn't provisioned here. The dev-server-only browser check above confirms the SPA itself is no longer the blocker; what's untested is the full stack integration.
- `scripts/mutate.mjs` is still fake (documented in the original audit) — unrelated to `web`.
