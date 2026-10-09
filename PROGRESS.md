# Progress

| Step | What was done | How (key files/commands) | Tests/verification | Status |
| --- | --- | --- | --- | --- |
| Week 1 | Created workspace skeleton, docs, and exact tool pins. | package.json, packages, web, npm view, tsc --init | `npm run build`, `npm run lint`, and `npm run test` all passed. | Complete |

## Decisions and deviations from blueprint

- lueprint.md at repository root is treated as canonical because docs/BLUEPRINT.md is absent.
- ESLint is deferred; lint currently runs the mechanical boundary check.


| Week 1 — Step 2 | Added dependency-boundary enforcement, ESLint purity enforcement, CI, and a Vitest smoke test. | scripts/check-boundaries.mjs, eslint.config.js, vitest.config.ts, .github/workflows/ci.yml | build, lint, boundary check, and test passed; Spike 2 and boundary failure outputs recorded in docs/versions.md. | Complete |

- ESLint 10.11.0 and typescript-eslint 8.71.0 were chosen after npm peer-range verification; typescript-eslint supports ESLint 10 and TypeScript <6.1.0.

| Week 1 — Step 3 | Added pinned compose configuration, Kafka/tinybench/pg dependencies, money codec P10, and journal int8 parser. | docker-compose.yml, common money codec/tests, journal integration helper, benchmarks hello benchmark. | Kafka import and local tests passed; Docker-dependent checks pending because Docker CLI is unavailable. | Complete with environment blocker |

| Week 1 — UI design governance | Added Stitch-reference workflow and frontend delivery constraints. | AGENTS.md, docs/decisions.md (#23), web/design/README.md | Documentation review. | Complete |

| Week 1 — Spec update | Canonicalized the updated blueprint and documented public demo registration plus frontend presentation constraints. | docs/BLUEPRINT.md, docs/decisions.md (#24), AGENTS.md | Documentation-only change; no product implementation. | Complete |

| Week 1 — Step 4 | Added opt-in PostgreSQL and Kafka spike harnesses; documented Kafka transaction APIs and rebalance fencing hook. | journal postgres integration test; shard spike4 script/test; docs/versions.md | Build passes; live spikes blocked by absent Docker/Kafka and missing Testcontainers installation materialization. | Blocked by environment |
- Deviation: Step 4 live Docker/Testcontainers proofs cannot run on this host because Docker CLI is absent and the requested Testcontainers packages could not be materialized by npm.

| Week 1 — Initial commit | Created root .gitignore and created initial git commit. | .gitignore, git init, git commit | `git status --short` verified clean. | Complete |

| Week 1 — Spikes 5–7 | Added Fastify/JWT/WebSocket, Redis money codec helpers, and the JSON/PostgreSQL/Redis bigint chain with opt-in live-service tests. | packages/api, packages/projections, packages/journal, docs/versions.md | `npm run build`, `npm run lint`, `npm run check:boundaries`, and `npm run test` pass; 11 passed and 4 live-service tests skipped by default. | Complete with environment blocker |

| Week 1 — CI integration job | Added a dependent GitHub Actions integration job that starts Postgres, Redis, and Kafka, waits with bounded service probes, runs all documented opt-in spike tests, collects logs, and tears services down. | .github/workflows/ci.yml, docs/versions.md | Not run locally; live verification is delegated to CI because Docker is unavailable. | Awaiting CI |

| Week 2 — Order book primitives | Added bigint-only matching types, side-aware sorted prices, FIFO price levels, O(1) order lookup/cancellation, immutable book snapshots, and U6/U15/P11 coverage. | packages/engine-core/src/matching/types.ts, packages/engine-core/src/book, docs/architecture.md | `npm run build`, `npm run lint`, `npm run check:boundaries`, and `npm test` pass; P11 runs 2000 cases. | Complete |

## Week 2 deviations

- The requested `docs/BLUEPRINT.md` and `docs/week2-plan.md` are absent in this checkout. The existing root `blueprint.md` and `docs/Week2.md` were treated as the available canonical sources.
- Matching was not implemented, as requested.

| Week 2 — Matching engine | Added synchronous LIMIT matching with maker-price fills, FIFO sweeps, validation rejections, monotonic event sequences, trade ids, accepted-id retention, and exact event tests. | packages/engine-core/src/matching/engine.ts and engine.test.ts; docs/decisions.md; docs/architecture.md | Final `npm run build`, `npm run lint`, `npm run check:boundaries`, and `npm test` pass. | Complete |
| Week 2 — IOC and cancel | Added IOC hard-cap matching with remainder cancellation, resting-order cancellation, cancel rejection, and exact U7-U10 coverage. | packages/engine-core/src/matching/engine.ts, engine.test.ts, matching/types.ts | `npm run build`, `npm run lint`, `npm run check:boundaries`, and `npm test` pass; 33 passed and 4 skipped. | Complete |
| Week 2 — Reference model properties | Added an independent slow array-based model and four fast-check properties covering P1/P2/P3-P4/P11, determinism, model equivalence, rejection immutability, engine sequences, and trade IDs. | packages/engine-core/src/matching/referenceModel.test.ts | Each property runs 2,000 cases with fixed seed `20261009`; `ENGINE_PROPERTY_SEED` overrides it locally. Full-suite duration recorded after final validation. | In progress |

### Week 2 property-test policy

- CI uses the fixed seed `20261009` for reproducible failures.
- Local runs may set `ENGINE_PROPERTY_SEED` to use a different seed.

- Final property counts: P1/P11 2,000; P2 2,000; P3/P4 2,000; determinism/model equivalence/rejection immutability/sequence checks 2,000.
- Full `npm test` duration: 22.69 seconds; 37 passed and 4 skipped.
- No source behavior changes or shrunk counterexample regressions were required.

| Week 2 — E3 benchmark and audit | Added tinybench benchmarks for adding into 100 levels, one-maker matching, and cancellation; setup runs in tinybench `beforeEach`. Audited engine-core source for keyed plain objects, number/bigint mixing, mutable exported internals, TODOs/not-implemented throws, and oversized functions; no findings required behavior changes. | packages/benchmarks/src/engine.bench.ts, docs/experiments.md, docs/architecture.md, docs/decisions.md | `npm run build`, `npm run lint`, `npm run check:boundaries`, and `npm test` pass. Test files: engine.test.ts 17, referenceModel.test.ts 4, orderBook.test.ts 3, sortedPrices.test.ts 2, index.test.ts 1; 37 passed and 4 skipped. Benchmark baseline recorded in E3. | Complete |
| Documentation repair | Repaired literal PowerShell newline escapes and control characters, corrected the versions snapshot and Spike 4 identifiers, updated the Week 2 smoke-baseline label, and aligned Copilot instructions with bigint minor-unit prices. | docs/decisions.md, docs/versions.md, docs/experiments.md, .github/copilot-instructions.md | Documentation checks will verify zero literal `` `n `` sequences and no control characters in docs/versions.md; engine-core source confirms bigint price representation. | Complete |
| API documentation | Added the hand-written REST contract and matching OpenAPI 3.1 document for auth, orders, market data, accounts, risk, and reconciliation. | docs/api.md, docs/openapi.yaml | Documentation-only; no code validation required. | Complete |
| Test plan | Added the complete layered testing contract from blueprint section 10 and `docs/api.md`, including U/P/C/R/K/X/F matrices, engine extensions, API/role matrix, WebSocket/UI/demo checks, MVP traceability, weekly exits, and current/proposed commands. | docs/test-plan.md | Documentation-only; current script availability checked against package.json. | Complete |
| API contract completion | Added reconciliation workflows, admin and system operations, complete WebSocket delivery rules, role/page/week maps, missing OpenAPI paths and schemas, query filters, response bodies, enums, quantity and trade-id constraints, and corrected authorization and audit rules. | docs/api.md, docs/openapi.yaml | `npx @redocly/cli lint docs/openapi.yaml` validates the API description; operation parity check reports 52 operations in each document. | Complete |
| Week 2 — Property-test performance | Replaced fast-check assertions with completion-checked `fc.check` calls, removed per-command snapshotting from P1/P11 and the order-book property, and gave all five property tests a shared 60-second timeout. | packages/engine-core/src/matching/referenceModel.test.ts, packages/engine-core/src/book/orderBook.test.ts | All properties retain 2,000 runs. Targeted durations: P1/P11 262 ms, P2 29 ms, P3/P4 108 ms, determinism/model equivalence 792 ms without temporary timing and 49.17 s during phase measurement, order-book add/cancel 218 ms. Temporary timing measured P1 apply 22.8 ms and final snapshot 8.6 ms; deterministic-property timing measured reference model 1.64 s, engine apply 1.55 s, and snapshots 17.49 s, confirming snapshots dominate; instrumentation was removed. Full suite: 37 passed, 4 skipped, 21.92 s. | Complete |
| Test-plan correction | Aligned the executable test plan with blueprint section 15, corrected unit-test configurations and API/WebSocket cases, added evidence paths for completed tests, marked P10 partial pending live CI, and added reconciliation, admin, and system endpoint cases. | docs/test-plan.md | Documentation-only review; no test code changed. | Complete |
| Architecture reference | Rewrote the architecture document as the single status-qualified reference for system context, package boundaries, component responsibilities, order lifecycle, events, Kafka, data model, correctness, failures, security, observability, deployment, and build status. | docs/architecture.md | Documentation-only; claims cite blueprint sections and ambiguities are listed under Assumptions. | Complete |
| Week 2 — Completion | Added OrderBook/Engine checkInvariants, depth, restingOrders; tests U18, U20, Example 1 views; invariants checked after every command in P1; decision 24. | book/orderBook.ts, matching/engine.ts | build/lint/test results below | Done |

| Week 3 — IOC stub and tests | Added `TimeInForce`, migrated GTC helpers/generators, changed user cancel events to `USER_REQUEST`, added EX1–EX3 carry-over tests, and added the U8–U34 IOC suite with an explicit unimplemented IOC branch. | packages/engine-core/src/matching/types.ts, packages/engine-core/src/matching/engine.ts, packages/engine-core/test | `npm run build`, `npm run lint`, and `npm run check:boundaries` pass. Week 2 plus EX1–EX3: 23 passed. Full suite: 51 passed, 6 fail. IOC suite: 12 passed and 6 fail with `IOC matching is not implemented` (U8, U9, U22, U23, U24, U25). | STUB complete; IOC implementation is next |

## Week 3 deviations and next step

- `docs/WEEK-3.md` and `docs/WEEK-2.md` were absent; the available `docs/week2-plan.md`, `docs/BLUEPRINT.md`, and current source were used.
- The existing checkout uses `orderType` on events and currently has no `takerRemaining` or `makerRemaining` fields. Tests retain those code-defined event shapes rather than inventing fields.
- Existing engine-core tests are under `src/`, while the new requested tests are under `packages/engine-core/test/`.
- The IOC stub currently throws after accepted orders have matched; Prompt 2 must make IOC validation/matching atomic and emit the exact terminal events without resting the IOC remainder.

| Week 3 — STUB handoff | Verified the IOC branch location and current stub without implementing it. The shared match loop is TIF-independent; only the post-loop tail branches on `timeInForce`. | packages/engine-core/src/matching/engine.ts | Existing Prompt 1 verification remains: build, lint, boundaries pass; IOC suite has 12 passing and 6 intentional stub failures. | Waiting for hand-written IOC implementation and REVIEW |

- Handoff checklist: implement the IOC-only post-loop `ORDER_CANCELLED` tail with `IOC_REMAINDER`; add/use one shared inclusive crossing predicate if needed; confirm the match loop remains independent of TIF and does not allocate/index/sequence an IOC remainder.
- Current stub text is `IOC matching is not implemented`, whereas the new prompt suggests `IOC not implemented: Week 3 hand-written`; this was left unchanged to avoid modifying the hand-written-test contract in STUB mode.
