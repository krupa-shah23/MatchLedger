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

