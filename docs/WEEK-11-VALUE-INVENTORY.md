# Static value and source inventories

Evidence: `/tmp/check-static-week11.py`, `/tmp/verify-week11.mjs`. Candidate inventories are not semantic approvals. Credential values are deliberately redacted.

## Value candidates

| Location | Classification |
|---|---|
| packages/shard/tsconfig.json:28 | a: config/default declaration |
| packages/shard/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/package.json:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/telemetry.test.ts:1 | c: test fixture |
| packages/telemetry/telemetry.test.ts:2 | c: test fixture |
| packages/telemetry/telemetry.test.ts:37 | c: test fixture |
| packages/telemetry/telemetry.test.ts:42 | c: test fixture |
| packages/telemetry/telemetry.test.ts:59 | c: test fixture |
| packages/telemetry/telemetry.test.ts:62 | c: test fixture |
| packages/telemetry/telemetry.test.ts:74 | c: test fixture |
| packages/telemetry/telemetry.test.ts:75 | c: test fixture |
| packages/telemetry/telemetry.test.ts:76 | c: test fixture |
| packages/telemetry/telemetry.test.ts:77 | c: test fixture |
| packages/telemetry/telemetry.test.ts:78 | c: test fixture |
| packages/ledger/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/simulator-integration.test.ts:1 | c: test fixture |
| packages/simulator/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/tsconfig.json:30 | a: config/default declaration |
| packages/runtime/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/package.json:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/package.json:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/tsconfig.json:36 | a: config/default declaration |
| packages/api/openapi.yaml:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/openapi.yaml:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/openapi.yaml:751 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/openapi.yaml:755 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/openapi.yaml:836 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/openapi.yaml:840 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/openapi.yaml:849 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/package.json:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/package.json:23 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/startup-config.ts:1 | a: config/default declaration |
| packages/api/src/startup-config.ts:7 | a: config/default declaration |
| packages/api/src/startup-config.ts:9 | a: config/default declaration |
| packages/api/src/startup-config.ts:10 | a: config/default declaration |
| packages/api/src/startup-config.ts:13 | a: config/default declaration |
| packages/api/src/startup-config.ts:19 | a: config/default declaration |
| packages/api/src/startup-config.ts:20 | a: config/default declaration |
| packages/api/src/config.ts:5 | a: config/default declaration |
| packages/api/src/config.ts:9 | a: config/default declaration |
| packages/api/src/config.ts:10 | a: config/default declaration |
| packages/api/src/config.ts:12 | a: config/default declaration |
| packages/api/src/config.ts:23 | a: config/default declaration |
| packages/api/src/config.ts:25 | a: config/default declaration |
| packages/api/src/metrics.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/metrics.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/metrics.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/metrics.ts:29 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/metrics.ts:37 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/metrics.ts:45 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/metrics.ts:53 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/metrics.ts:62 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/metrics.ts:70 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/metrics.ts:75 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/contracts.test.ts:7 | c: test fixture |
| packages/api/src/test-helpers.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:154 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:208 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:217 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:218 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:220 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:250 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/test-helpers.ts:271 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/startup-config.test.ts:1 | c: test fixture |
| packages/api/src/startup-config.test.ts:2 | c: test fixture |
| packages/api/src/startup-config.test.ts:7 | c: test fixture |
| packages/api/src/startup-config.test.ts:9 | c: test fixture |
| packages/api/src/startup-config.test.ts:11 | c: test fixture |
| packages/api/src/startup-config.test.ts:12 | c: test fixture |
| packages/api/src/startup-config.test.ts:13 | c: test fixture |
| packages/api/src/startup-config.test.ts:15 | c: test fixture |
| packages/api/src/config.test.ts:5 | c: test fixture |
| packages/api/src/config.test.ts:6 | c: test fixture |
| packages/api/src/config.test.ts:10 | c: test fixture |
| packages/api/src/config.test.ts:11 | c: test fixture |
| packages/api/src/config.test.ts:13 | c: test fixture |
| packages/api/src/config.test.ts:28 | c: test fixture |
| packages/api/src/config.test.ts:38 | c: test fixture |
| packages/api/src/config.test.ts:42 | c: test fixture |
| packages/api/src/config.test.ts:44 | c: test fixture |
| packages/api/src/config.test.ts:45 | c: test fixture |
| packages/api/src/config.test.ts:51 | c: test fixture |
| packages/api/src/config.test.ts:59 | c: test fixture |
| packages/api/src/config.test.ts:60 | c: test fixture |
| packages/api/src/config.test.ts:68 | c: test fixture |
| packages/api/src/config.test.ts:69 | c: test fixture |
| packages/api/src/metrics.test.ts:5 | c: test fixture |
| packages/api/src/metrics.test.ts:8 | c: test fixture |
| packages/api/src/metrics.test.ts:9 | c: test fixture |
| packages/api/src/main.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:45 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:49 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:61 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:64 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:65 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:71 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:72 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:73 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/main.ts:78 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/index.test.ts:1 | c: test fixture |
| packages/api/src/index.test.ts:2 | c: test fixture |
| packages/api/src/index.test.ts:3 | c: test fixture |
| packages/api/src/index.test.ts:4 | c: test fixture |
| packages/api/src/index.test.ts:90 | c: test fixture |
| packages/api/src/index.test.ts:162 | c: test fixture |
| packages/api/src/index.test.ts:181 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:1 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:2 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:3 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:4 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:5 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:6 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:7 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:8 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:9 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:13 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:14 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:15 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:31 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:33 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:35 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:72 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:73 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:82 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:84 | c: test fixture |
| packages/api/src/week11-live.int.test.ts:89 | c: test fixture |
| packages/api/src/e2e.test.ts:5 | c: test fixture |
| packages/api/src/e2e.test.ts:8 | c: test fixture |
| packages/api/src/e2e.test.ts:10 | c: test fixture |
| packages/api/src/e2e.test.ts:12 | c: test fixture |
| packages/api/src/openapi.test.ts:5 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:1 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:2 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:3 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:4 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:5 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:6 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:7 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:8 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:9 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:10 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:11 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:12 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:13 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:23 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:24 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:25 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:30 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:36 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:38 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:39 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:40 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:50 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:71 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:112 | c: test fixture |
| packages/api/src/live-verification.int.test.ts:122 | c: test fixture |
| packages/api/src/fastify.d.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/index.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/index.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/index.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/system-tests.test.ts:1 | c: test fixture |
| packages/api/src/app.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:23 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:24 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:26 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:28 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/app.ts:99 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/gateway.test.ts:2 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:5 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:6 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:7 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:8 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:9 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:10 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:12 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:16 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:17 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:18 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:19 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:44 | c: test fixture |
| packages/api/src/ws/gateway.test.ts:49 | c: test fixture |
| packages/api/src/ws/hub.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/hub.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/hub.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/hub.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/hub.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/hub.test.ts:5 | c: test fixture |
| packages/api/src/ws/hub.test.ts:6 | c: test fixture |
| packages/api/src/ws/gateway.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/gateway.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/gateway.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/gateway.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/gateway.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/gateway.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/gateway.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/gateway.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/gateway.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/ws/gateway.ts:122 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/rbac.test.ts:6 | c: test fixture |
| packages/api/src/plugins/rate-limit.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/rate-limit.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/errors.test.ts:5 | c: test fixture |
| packages/api/src/plugins/errors.test.ts:6 | c: test fixture |
| packages/api/src/plugins/errors.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/errors.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/errors.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/errors.ts:30 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/errors.ts:51 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/rate-limit.test.ts:5 | c: test fixture |
| packages/api/src/plugins/rate-limit.test.ts:6 | c: test fixture |
| packages/api/src/plugins/request-context.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/request-context.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/request-context.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/request-context.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/request-context.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/request-context.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/request-context.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/request-context.ts:66 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/request-context.ts:118 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/plugins/request-context.ts:138 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/system/prom-queries.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/system/prom-queries.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/orders/submit.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/orders/submit.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/orders/submit.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/orders/submit.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/orders/submit.ts:31 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/orders/submit.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/orders/single-flight.test.ts:5 | c: test fixture |
| packages/api/src/orders/single-flight.test.ts:6 | c: test fixture |
| packages/api/src/orders/single-flight.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/passwords.test.ts:2 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:5 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:6 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:10 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:12 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:13 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:14 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:20 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:21 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:25 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:26 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:31 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:32 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:49 | c: test fixture |
| packages/api/src/auth/passwords.test.ts:62 | c: test fixture |
| packages/api/src/auth/tokens.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/tokens.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/tokens.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/tokens.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/tokens.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/tokens.ts:49 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/passwords.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/passwords.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/passwords.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/passwords.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/passwords.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/passwords.ts:33 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/passwords.ts:36 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/passwords.ts:65 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/passwords.ts:94 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/tokens.test.ts:5 | c: test fixture |
| packages/api/src/auth/tokens.test.ts:6 | c: test fixture |
| packages/api/src/auth/users.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/users.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/users.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/users.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/users.ts:34 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/users.ts:46 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/auth/users.ts:58 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/demo/seed.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/demo/seed.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/demo/seed.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/demo/seed.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/demo/seed.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/demo/seed.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:36 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:37 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:44 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:47 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:151 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:260 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:358 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:437 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:439 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:462 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:463 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:466 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:474 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/system.ts:480 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/recon.test.ts:5 | c: test fixture |
| packages/api/src/routes/recon.test.ts:6 | c: test fixture |
| packages/api/src/routes/recon.test.ts:7 | c: test fixture |
| packages/api/src/routes/orders.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/orders.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/orders.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/orders.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/orders.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/orders.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/orders.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/orders.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/orders.ts:51 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/orders.ts:56 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:29 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:35 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:43 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:80 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:81 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/admin.ts:229 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/accounts.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/accounts.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/accounts.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/accounts.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/accounts.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/accounts.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/market.test.ts:5 | c: test fixture |
| packages/api/src/routes/market.test.ts:6 | c: test fixture |
| packages/api/src/routes/market.test.ts:7 | c: test fixture |
| packages/api/src/routes/auth.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:23 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:35 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:43 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:67 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:122 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/auth.ts:184 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/orders.test.ts:6 | c: test fixture |
| packages/api/src/routes/orders.test.ts:7 | c: test fixture |
| packages/api/src/routes/orders.test.ts:8 | c: test fixture |
| packages/api/src/routes/admin.test.ts:5 | c: test fixture |
| packages/api/src/routes/admin.test.ts:6 | c: test fixture |
| packages/api/src/routes/admin.test.ts:7 | c: test fixture |
| packages/api/src/routes/admin.test.ts:30 | c: test fixture |
| packages/api/src/routes/admin.test.ts:56 | c: test fixture |
| packages/api/src/routes/admin.test.ts:61 | c: test fixture |
| packages/api/src/routes/admin.test.ts:71 | c: test fixture |
| packages/api/src/routes/admin.test.ts:79 | c: test fixture |
| packages/api/src/routes/system.test.ts:5 | c: test fixture |
| packages/api/src/routes/system.test.ts:6 | c: test fixture |
| packages/api/src/routes/system.test.ts:7 | c: test fixture |
| packages/api/src/routes/system.test.ts:8 | c: test fixture |
| packages/api/src/routes/system.test.ts:9 | c: test fixture |
| packages/api/src/routes/system.test.ts:102 | c: test fixture |
| packages/api/src/routes/system.test.ts:188 | c: test fixture |
| packages/api/src/routes/system.test.ts:274 | c: test fixture |
| packages/api/src/routes/system.test.ts:412 | c: test fixture |
| packages/api/src/routes/system.test.ts:413 | c: test fixture |
| packages/api/src/routes/system.test.ts:415 | c: test fixture |
| packages/api/src/routes/system.test.ts:424 | c: test fixture |
| packages/api/src/routes/accounts.test.ts:6 | c: test fixture |
| packages/api/src/routes/accounts.test.ts:7 | c: test fixture |
| packages/api/src/routes/accounts.test.ts:8 | c: test fixture |
| packages/api/src/routes/market.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/market.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/market.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/market.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/market.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/market.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/recon.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/recon.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/recon.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/recon.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/recon.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/recon.ts:24 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/recon.ts:28 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/risk.test.ts:5 | c: test fixture |
| packages/api/src/routes/risk.test.ts:6 | c: test fixture |
| packages/api/src/routes/risk.test.ts:7 | c: test fixture |
| packages/api/src/routes/risk.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/risk.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/risk.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/risk.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/risk.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/risk.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/api/src/routes/risk.ts:24 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/mappers.test.ts:1 | c: test fixture |
| packages/projections/src/mappers.test.ts:2 | c: test fixture |
| packages/projections/src/notices.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/notices.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/property-tests.test.ts:6 | c: test fixture |
| packages/projections/src/order-facts.test.ts:1 | c: test fixture |
| packages/projections/src/order-facts.test.ts:2 | c: test fixture |
| packages/projections/src/order-facts.test.ts:3 | c: test fixture |
| packages/projections/src/pnl.test.ts:9 | c: test fixture |
| packages/projections/src/pnl.test.ts:10 | c: test fixture |
| packages/projections/src/queries.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:62 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:81 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:105 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:119 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:131 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:143 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:155 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:166 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:177 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/queries.ts:190 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/projector.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/projector.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/projector.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/projector.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/projector.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/projector.test.ts:1 | c: test fixture |
| packages/projections/src/projector.test.ts:2 | c: test fixture |
| packages/projections/src/projector.test.ts:3 | c: test fixture |
| packages/projections/src/incident-time.test.ts:1 | c: test fixture |
| packages/projections/src/incident-time.test.ts:2 | c: test fixture |
| packages/projections/src/index.test.ts:1 | c: test fixture |
| packages/projections/src/index.test.ts:2 | c: test fixture |
| packages/projections/src/index.test.ts:3 | c: test fixture |
| packages/projections/src/index.test.ts:4 | c: test fixture |
| packages/projections/src/index.test.ts:29 | c: test fixture |
| packages/projections/src/order-facts.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/order-facts.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/order-facts.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:28 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:29 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:30 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:31 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:32 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:33 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:34 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:35 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:50 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/index.ts:55 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/checkpoints.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/checkpoints.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/checkpoints.ts:47 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/mappers.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/mappers.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| packages/projections/src/mappers.ts:228 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/index.test.ts:1 | c: test fixture |
| packages/engine-core/src/index.test.ts:2 | c: test fixture |
| packages/engine-core/src/index.test.ts:5 | c: test fixture |
| packages/engine-core/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/index.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/index.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/index.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/index.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/index.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/test/properties.snapshot.test.ts:1 | c: test fixture |
| packages/engine-core/test/properties.snapshot.test.ts:2 | c: test fixture |
| packages/engine-core/test/properties.snapshot.test.ts:3 | c: test fixture |
| packages/engine-core/test/properties.snapshot.test.ts:4 | c: test fixture |
| packages/engine-core/test/helpers.ts:1 | c: test fixture |
| packages/engine-core/test/helpers.ts:2 | c: test fixture |
| packages/engine-core/test/helpers.ts:3 | c: test fixture |
| packages/engine-core/test/helpers.ts:5 | c: test fixture |
| packages/engine-core/test/helpers.ts:13 | c: test fixture |
| packages/engine-core/test/helpers.ts:33 | c: test fixture |
| packages/engine-core/test/helpers.ts:39 | c: test fixture |
| packages/engine-core/test/helpers.ts:43 | c: test fixture |
| packages/engine-core/test/examples.test.ts:1 | c: test fixture |
| packages/engine-core/test/examples.test.ts:2 | c: test fixture |
| packages/engine-core/test/examples.test.ts:3 | c: test fixture |
| packages/engine-core/test/breaker-integration.test.ts:1 | c: test fixture |
| packages/engine-core/test/breaker-integration.test.ts:2 | c: test fixture |
| packages/engine-core/test/breaker-integration.test.ts:3 | c: test fixture |
| packages/engine-core/test/breaker-integration.test.ts:23 | c: test fixture |
| packages/engine-core/test/properties.recovery.test.ts:1 | c: test fixture |
| packages/engine-core/test/properties.recovery.test.ts:2 | c: test fixture |
| packages/engine-core/test/properties.recovery.test.ts:3 | c: test fixture |
| packages/engine-core/test/breaker.test.ts:1 | c: test fixture |
| packages/engine-core/test/breaker.test.ts:2 | c: test fixture |
| packages/engine-core/test/breaker.test.ts:4 | c: test fixture |
| packages/engine-core/test/breaker.test.ts:5 | c: test fixture |
| packages/engine-core/test/breaker.test.ts:6 | c: test fixture |
| packages/engine-core/test/breaker.test.ts:55 | c: test fixture |
| packages/engine-core/test/ioc.test.ts:1 | c: test fixture |
| packages/engine-core/test/ioc.test.ts:2 | c: test fixture |
| packages/engine-core/test/ioc.test.ts:3 | c: test fixture |
| packages/engine-core/test/ioc.test.ts:4 | c: test fixture |
| packages/engine-core/test/reference-breaker.ts:1 | c: test fixture |
| packages/engine-core/test/reference-breaker.ts:2 | c: test fixture |
| packages/engine-core/test/reference-breaker.ts:4 | c: test fixture |
| packages/engine-core/test/reference-breaker.ts:15 | c: test fixture |
| packages/engine-core/test/snapshot.test.ts:1 | c: test fixture |
| packages/engine-core/test/snapshot.test.ts:2 | c: test fixture |
| packages/engine-core/test/snapshot.test.ts:3 | c: test fixture |
| packages/engine-core/test/snapshot.test.ts:4 | c: test fixture |
| packages/engine-core/test/snapshot.test.ts:5 | c: test fixture |
| packages/engine-core/test/snapshot.test.ts:6 | c: test fixture |
| packages/engine-core/test/snapshot.test.ts:197 | c: test fixture |
| packages/engine-core/test/properties.test.ts:1 | c: test fixture |
| packages/engine-core/test/properties.test.ts:2 | c: test fixture |
| packages/engine-core/test/properties.test.ts:3 | c: test fixture |
| packages/engine-core/test/properties.test.ts:4 | c: test fixture |
| packages/engine-core/test/properties.test.ts:5 | c: test fixture |
| packages/engine-core/test/properties.test.ts:6 | c: test fixture |
| packages/engine-core/test/properties.test.ts:7 | c: test fixture |
| packages/engine-core/test/properties.test.ts:8 | c: test fixture |
| packages/engine-core/test/helpers/reference-matcher.ts:1 | c: test fixture |
| packages/engine-core/test/helpers/reference-matcher.ts:13 | c: test fixture |
| packages/engine-core/test/helpers/arbitraries.ts:1 | c: test fixture |
| packages/engine-core/test/helpers/arbitraries.ts:2 | c: test fixture |
| packages/engine-core/test/helpers/arbitraries.ts:4 | c: test fixture |
| packages/engine-core/test/helpers/arbitraries.ts:27 | c: test fixture |
| packages/engine-core/test/helpers/arbitraries.ts:55 | c: test fixture |
| packages/engine-core/test/helpers/assert-invariants.ts:1 | c: test fixture |
| packages/engine-core/test/helpers/assert-invariants.ts:2 | c: test fixture |
| packages/engine-core/test/helpers/assert-invariants.ts:4 | c: test fixture |
| packages/engine-core/test/helpers/event-analysis.ts:1 | c: test fixture |
| packages/engine-core/test/helpers/event-analysis.ts:2 | c: test fixture |
| packages/engine-core/test/helpers/event-analysis.ts:4 | c: test fixture |
| packages/engine-core/test/helpers/event-analysis.ts:9 | c: test fixture |
| packages/engine-core/test/helpers/event-analysis.ts:23 | c: test fixture |
| packages/engine-core/test/helpers/event-analysis.ts:30 | c: test fixture |
| packages/engine-core/test/helpers/event-analysis.ts:36 | c: test fixture |
| packages/engine-core/test/helpers/event-analysis.ts:80 | c: test fixture |
| packages/engine-core/src/breaker/types.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:38 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:43 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:49 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:54 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:56 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/types.ts:95 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/breaker.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/breaker.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/breaker.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/breaker.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/volatility.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/volatility.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/volatility.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/volatility.ts:31 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/breaker/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/orderBook.test.ts:1 | c: test fixture |
| packages/engine-core/src/book/orderBook.test.ts:2 | c: test fixture |
| packages/engine-core/src/book/orderBook.test.ts:3 | c: test fixture |
| packages/engine-core/src/book/orderBook.test.ts:4 | c: test fixture |
| packages/engine-core/src/book/orderBook.test.ts:89 | c: test fixture |
| packages/engine-core/src/book/sortedPrices.test.ts:1 | c: test fixture |
| packages/engine-core/src/book/sortedPrices.test.ts:2 | c: test fixture |
| packages/engine-core/src/book/sortedPrices.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/sortedPrices.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/priceLevel.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/priceLevel.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/priceLevel.ts:31 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/orderBook.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/orderBook.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/orderBook.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/orderBook.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/orderBook.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/orderBook.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/orderBook.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/orderBook.ts:30 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/snapshot.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/snapshot.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/snapshot.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/snapshot.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/snapshot.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/snapshot.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/snapshot.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/book/snapshot.ts:55 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/engine.test.ts:1 | c: test fixture |
| packages/engine-core/src/matching/engine.test.ts:2 | c: test fixture |
| packages/engine-core/src/matching/engine.test.ts:3 | c: test fixture |
| packages/engine-core/src/matching/engine.test.ts:152 | c: test fixture |
| packages/engine-core/src/matching/engine.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/engine.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/engine.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:33 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:38 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:40 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:49 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:50 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:52 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:64 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:74 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:89 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:98 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:106 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:114 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:123 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/types.ts:134 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/engine-core/src/matching/referenceModel.test.ts:1 | c: test fixture |
| packages/engine-core/src/matching/referenceModel.test.ts:2 | c: test fixture |
| packages/engine-core/src/matching/referenceModel.test.ts:3 | c: test fixture |
| packages/engine-core/src/matching/referenceModel.test.ts:4 | c: test fixture |
| packages/engine-core/src/matching/referenceModel.test.ts:233 | c: test fixture |
| packages/engine-core/src/matching/referenceModel.test.ts:236 | c: test fixture |
| packages/engine-core/src/matching/referenceModel.test.ts:247 | c: test fixture |
| packages/transport/src/transport-factory.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:23 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:24 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:29 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:32 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport-factory.ts:36 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/transport.int.test.ts:1 | c: test fixture |
| packages/transport/src/transport.int.test.ts:2 | c: test fixture |
| packages/transport/src/transport.int.test.ts:64 | c: test fixture |
| packages/transport/src/transport.int.test.ts:65 | c: test fixture |
| packages/transport/src/transport.int.test.ts:170 | c: test fixture |
| packages/transport/src/transport.int.test.ts:200 | c: test fixture |
| packages/transport/src/consumer.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/consumer.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/consumer.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/consumer.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/consumer.ts:48 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/index.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/envelope.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/envelope.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/envelope.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/envelope.ts:24 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/envelope.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/envelope.ts:51 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/startup-checks.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/startup-checks.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/startup-checks.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/kafka-event-sink.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/kafka-event-sink.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/kafka-event-sink.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/kafka-event-sink.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/kafka-event-sink.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/producer.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/producer.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/producer.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/producer.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/transport/src/producer.ts:29 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/sweeper.test.ts:1 | c: test fixture |
| packages/risk/src/sweeper.test.ts:3 | c: test fixture |
| packages/risk/src/naive-risk.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/naive-risk.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/naive-risk.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/naive-risk.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.test.ts:1 | c: test fixture |
| packages/risk/src/stage.test.ts:3 | c: test fixture |
| packages/risk/src/stage.test.ts:4 | c: test fixture |
| packages/risk/src/stage.test.ts:5 | c: test fixture |
| packages/risk/src/stage.test.ts:6 | c: test fixture |
| packages/risk/src/halt-policy.test.ts:1 | c: test fixture |
| packages/risk/src/halt-policy.test.ts:2 | c: test fixture |
| packages/risk/src/dedupe-bounds.test.ts:5 | c: test fixture |
| packages/risk/src/dedupe-bounds.test.ts:6 | c: test fixture |
| packages/risk/src/dedupe-bounds.test.ts:10 | c: test fixture |
| packages/risk/src/sweeper.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/sweeper.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/types.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/types.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/types.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/types.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stamper.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stamper.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/router.test.ts:1 | c: test fixture |
| packages/risk/src/router.test.ts:2 | c: test fixture |
| packages/risk/src/router.test.ts:3 | c: test fixture |
| packages/risk/src/router.test.ts:4 | c: test fixture |
| packages/risk/src/router.test.ts:62 | c: test fixture |
| packages/risk/src/orders-submitted-consumer.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/orders-submitted-consumer.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/orders-submitted-consumer.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/orders-submitted-consumer.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/orders-submitted-consumer.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/orders-submitted-consumer.ts:53 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/orders-submitted-consumer.ts:105 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/delays.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/delays.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/errors.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/errors.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/in-memory-risk-journal.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/in-memory-risk-journal.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.ts:38 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/stage.ts:65 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/decide.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/decide.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/dedupe-bounds.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/dedupe-bounds.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/dedupe-bounds.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/dedupe-bounds.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/dedupe-bounds.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/dedupe-bounds.ts:43 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/dedupe-bounds.ts:65 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/dedupe-bounds.ts:70 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/dedupe-bounds.ts:78 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/dedupe-bounds.ts:80 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/index.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/market-view.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/market-view.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/serialized-risk.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/serialized-risk.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/serialized-risk.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/serialized-risk.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/serialized-risk.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/account-store.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/account-store.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/account-store.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/market-view.test.ts:1 | c: test fixture |
| packages/risk/src/market-view.test.ts:3 | c: test fixture |
| packages/risk/src/router.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/router.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/router.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/router.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/router.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/router.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/router.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/router.ts:33 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/test/core-helpers.test.ts:1 | c: test fixture |
| packages/risk/test/core-helpers.test.ts:2 | c: test fixture |
| packages/risk/test/core-helpers.test.ts:4 | c: test fixture |
| packages/risk/test/core-helpers.test.ts:6 | c: test fixture |
| packages/risk/test/core-helpers.test.ts:7 | c: test fixture |
| packages/risk/test/risk.test.ts:1 | c: test fixture |
| packages/risk/test/risk.test.ts:2 | c: test fixture |
| packages/risk/test/risk.test.ts:3 | c: test fixture |
| packages/risk/test/risk.test.ts:12 | c: test fixture |
| packages/risk/dist-test/risk.test.d.ts:1 | c: test fixture |
| packages/risk/dist-test/core-helpers.test.js:1 | c: test fixture |
| packages/risk/dist-test/core-helpers.test.js:2 | c: test fixture |
| packages/risk/dist-test/core-helpers.test.js:3 | c: test fixture |
| packages/risk/dist-test/core-helpers.test.js:4 | c: test fixture |
| packages/risk/dist-test/core-helpers.test.d.ts:1 | c: test fixture |
| packages/risk/dist-test/risk.test.js:1 | c: test fixture |
| packages/risk/dist-test/risk.test.js:2 | c: test fixture |
| packages/risk/dist-test/risk.test.js:3 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:1 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:2 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:3 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:4 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:5 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:6 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:7 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:10 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:35 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:75 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:76 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-store.test.ts:87 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.test.ts:1 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.test.ts:2 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.test.ts:3 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.test.ts:4 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.test.ts:5 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.test.ts:6 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.test.ts:7 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.test.ts:8 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.test.ts:11 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.test.ts:31 | c: test fixture |
| packages/risk/src/persistence/durable-risk-outbox.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/durable-risk-outbox.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/durable-risk-outbox.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/pg-risk-journal.test.ts:1 | c: test fixture |
| packages/risk/src/persistence/pg-risk-journal.test.ts:2 | c: test fixture |
| packages/risk/src/persistence/pg-risk-journal.test.ts:3 | c: test fixture |
| packages/risk/src/persistence/pg-risk-journal.test.ts:4 | c: test fixture |
| packages/risk/src/persistence/pg-risk-journal.test.ts:5 | c: test fixture |
| packages/risk/src/persistence/pg-risk-journal.test.ts:6 | c: test fixture |
| packages/risk/src/persistence/pg-risk-journal.test.ts:9 | c: test fixture |
| packages/risk/src/persistence/pg-risk-journal.test.ts:19 | c: test fixture |
| packages/risk/src/persistence/durable-outbox.test.ts:1 | c: test fixture |
| packages/risk/src/persistence/durable-outbox.test.ts:2 | c: test fixture |
| packages/risk/src/persistence/durable-outbox.test.ts:3 | c: test fixture |
| packages/risk/src/persistence/durable-outbox.test.ts:4 | c: test fixture |
| packages/risk/src/persistence/durable-outbox.test.ts:5 | c: test fixture |
| packages/risk/src/persistence/durable-outbox.test.ts:6 | c: test fixture |
| packages/risk/src/persistence/durable-outbox.test.ts:9 | c: test fixture |
| packages/risk/src/persistence/durable-outbox.test.ts:19 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-scheduler.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-scheduler.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-scheduler.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-scheduler.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-scheduler.ts:26 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-scheduler.ts:29 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-store.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-store.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-store.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-store.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-store.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-store.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-store.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-store.ts:33 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/risk-snapshot-store.ts:51 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:1 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:2 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:3 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:4 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:5 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:6 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:7 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:8 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:9 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:12 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:26 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:45 | c: test fixture |
| packages/risk/src/persistence/snapshot-scheduler.test.ts:48 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-scheduler.test.ts:1 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-scheduler.test.ts:2 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-scheduler.test.ts:3 | c: test fixture |
| packages/risk/src/persistence/risk-snapshot-scheduler.test.ts:4 | c: test fixture |
| packages/risk/src/persistence/order-owners.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/order-owners.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/order-owners.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/order-owners.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/order-owners.ts:24 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/errors.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/pg-risk-journal.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/pg-risk-journal.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/pg-risk-journal.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/pg-risk-journal.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/pg-risk-journal.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/pg-risk-journal.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/persistence/order-owners.test.ts:1 | c: test fixture |
| packages/risk/src/persistence/order-owners.test.ts:2 | c: test fixture |
| packages/risk/src/persistence/order-owners.test.ts:3 | c: test fixture |
| packages/risk/src/persistence/order-owners.test.ts:4 | c: test fixture |
| packages/risk/src/persistence/order-owners.test.ts:5 | c: test fixture |
| packages/risk/src/persistence/order-owners.test.ts:6 | c: test fixture |
| packages/risk/src/persistence/order-owners.test.ts:9 | c: test fixture |
| packages/risk/src/persistence/order-owners.test.ts:20 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:1 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:2 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:4 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:6 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:7 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:48 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:49 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:50 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:63 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:64 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:67 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:68 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:75 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:76 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:81 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:82 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:86 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:90 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:91 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:99 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:100 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:115 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:117 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:124 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:125 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:127 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:143 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:144 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:194 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:210 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:332 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:369 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:386 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:408 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:413 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:414 | c: test fixture |
| packages/risk/src/core/risk-state.test.ts:416 | c: test fixture |
| packages/risk/src/core/reference.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/reference.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/reference.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/reference.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/reference.ts:34 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/risk-adjustment.test.ts:1 | c: test fixture |
| packages/risk/src/core/risk-adjustment.test.ts:3 | c: test fixture |
| packages/risk/src/core/risk-adjustment.test.ts:5 | c: test fixture |
| packages/risk/src/core/state.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/state.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/state.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/state.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/state.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/state.ts:47 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/state.ts:55 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/errors.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/errors.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/index.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/index.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/index.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/index.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/money.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/money.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/money.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/money.ts:23 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/money.ts:30 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/money.ts:40 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/risk-core.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/risk-core.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/risk-core.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/risk-core.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/risk-core.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/core/risk-core.ts:85 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/risk-export.test.ts:1 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:2 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:3 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:5 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:10 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:11 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:15 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:16 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:22 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:24 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:26 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:27 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:51 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:54 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:62 | c: test fixture |
| packages/risk/src/recovery/risk-export.test.ts:65 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:1 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:2 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:3 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:4 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:5 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:6 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:7 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:8 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:9 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:10 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:11 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:14 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:28 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:87 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:104 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:114 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:140 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:166 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:222 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:233 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.test.ts:261 | c: test fixture |
| packages/risk/src/recovery/recover-risk-partition.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/recover-risk-partition.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/recover-risk-partition.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/recover-risk-partition.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/recover-risk-partition.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/recover-risk-partition.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/recover-risk-partition.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/recover-risk-partition.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/recover-risk-partition.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/recover-risk-partition.ts:26 | UNVERIFIED: production/script value needs semantic classification |
| packages/risk/src/recovery/property-tests.test.ts:1 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:2 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:3 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:4 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:21 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:22 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:23 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:27 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:44 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:45 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:61 | c: test fixture |
| packages/risk/src/recovery/property-tests.test.ts:75 | c: test fixture |
| packages/risk/src/recovery/risk-codec.test.ts:1 | c: test fixture |
| packages/common/src/recovery-types.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/recovery-types.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/recovery-types.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/recovery-types.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/recovery-types.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/recovery-types.ts:31 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/recovery-types.ts:37 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/recovery-types.ts:40 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/recovery-types.ts:43 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/recovery-types.ts:44 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/schemas.test.ts:1 | c: test fixture |
| packages/common/src/schemas.test.ts:2 | c: test fixture |
| packages/common/src/schemas.test.ts:3 | c: test fixture |
| packages/common/src/schemas.test.ts:4 | c: test fixture |
| packages/common/src/ui-schemas.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:28 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:30 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:32 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:35 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:37 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:44 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:49 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:52 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:58 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:60 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:61 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:63 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:78 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:80 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:84 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:86 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:90 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:92 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:96 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:98 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:102 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:104 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:110 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:112 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:117 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:119 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:120 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:123 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:127 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:129 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:133 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:136 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:143 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:145 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:150 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:153 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:157 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:159 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:164 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:166 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.ts:172 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/money.test.ts:1 | c: test fixture |
| packages/common/src/money.test.ts:2 | c: test fixture |
| packages/common/src/money.test.ts:3 | c: test fixture |
| packages/common/src/risk-types.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:26 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:36 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:40 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:81 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:90 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:101 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:108 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:135 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:219 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:226 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:234 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/risk-types.ts:239 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/shard-ports.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/shard-ports.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/shard-ports.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/shard-ports.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/shard-ports.ts:35 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/shard-ports.ts:36 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/shard-ports.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/shard-ports.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/partition.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/partition.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-config.ts:8 | a: config/default declaration |
| packages/common/src/ui-config.ts:10 | a: config/default declaration |
| packages/common/src/ui-config.ts:15 | a: config/default declaration |
| packages/common/src/ui-config.ts:18 | a: config/default declaration |
| packages/common/src/ui-config.ts:25 | a: config/default declaration |
| packages/common/src/ui-config.ts:36 | a: config/default declaration |
| packages/common/src/ui-config.ts:48 | a: config/default declaration |
| packages/common/src/ui-config.ts:60 | a: config/default declaration |
| packages/common/src/codec.test.ts:1 | c: test fixture |
| packages/common/src/codec.test.ts:2 | c: test fixture |
| packages/common/src/codec.test.ts:3 | c: test fixture |
| packages/common/src/codec.test.ts:4 | c: test fixture |
| packages/common/src/codec.test.ts:5 | c: test fixture |
| packages/common/src/order-translation.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/order-translation.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/order-translation.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/async-queue.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/async-queue.ts:28 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:31 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:32 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:33 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:34 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:35 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:36 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:37 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:38 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:39 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:40 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:43 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:44 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:45 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/index.ts:46 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/bounded-queue.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/bounded-queue.ts:40 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/quantity.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/quantity.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/quantity.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/money.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/money.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/money.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/money.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/seq-deduper.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/ui-schemas.test.ts:5 | c: test fixture |
| packages/common/src/ui-schemas.test.ts:6 | c: test fixture |
| packages/common/src/ui-schemas.test.ts:14 | c: test fixture |
| packages/common/src/ui-schemas.test.ts:18 | c: test fixture |
| packages/common/src/ui-schemas.test.ts:21 | c: test fixture |
| packages/common/test/risk-helpers.test.ts:1 | c: test fixture |
| packages/common/test/risk-helpers.test.ts:2 | c: test fixture |
| packages/common/test/risk-helpers.test.ts:4 | c: test fixture |
| packages/common/test/risk-helpers.test.ts:25 | c: test fixture |
| packages/common/test/quantity.test.ts:1 | c: test fixture |
| packages/common/test/quantity.test.ts:2 | c: test fixture |
| packages/common/test/quantity.test.ts:3 | c: test fixture |
| packages/common/test/quantity.test.ts:48 | c: test fixture |
| packages/common/test/bounded-queue.test.ts:1 | c: test fixture |
| packages/common/test/bounded-queue.test.ts:2 | c: test fixture |
| packages/common/test/bounded-queue.test.ts:3 | c: test fixture |
| packages/common/dist-test/quantity.test.d.ts:1 | c: test fixture |
| packages/common/dist-test/bounded-queue.test.js:1 | c: test fixture |
| packages/common/dist-test/bounded-queue.test.js:2 | c: test fixture |
| packages/common/dist-test/bounded-queue.test.js:3 | c: test fixture |
| packages/common/dist-test/bounded-queue.test.d.ts:1 | c: test fixture |
| packages/common/dist-test/risk-helpers.test.js:1 | c: test fixture |
| packages/common/dist-test/risk-helpers.test.js:2 | c: test fixture |
| packages/common/dist-test/risk-helpers.test.js:3 | c: test fixture |
| packages/common/dist-test/risk-helpers.test.js:21 | c: test fixture |
| packages/common/dist-test/risk-helpers.test.d.ts:1 | c: test fixture |
| packages/common/dist-test/quantity.test.js:1 | c: test fixture |
| packages/common/dist-test/quantity.test.js:2 | c: test fixture |
| packages/common/dist-test/quantity.test.js:3 | c: test fixture |
| packages/common/dist-test/quantity.test.js:40 | c: test fixture |
| packages/common/src/codec/versioning.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/versioning.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/versioning.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/versioning.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/versioning.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/events.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/events.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/events.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/events.ts:69 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-commands.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-commands.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-commands.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-commands.ts:120 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/codec-error.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/codec-error.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/codec-error.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/codec-error.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/codec-error.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/codec-error.ts:36 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/codec-error.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/codec-error.ts:49 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/codec-error.ts:55 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/codec-error.ts:64 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/commands.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/commands.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/commands.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/commands.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-events.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-events.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-events.ts:57 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-events.ts:156 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/book-snapshot.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/book-snapshot.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/book-snapshot.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/book-snapshot.ts:83 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-codecs.test.ts:1 | c: test fixture |
| packages/common/src/codec/risk-codecs.test.ts:2 | c: test fixture |
| packages/common/src/codec/risk-codecs.test.ts:3 | c: test fixture |
| packages/common/src/codec/risk-codecs.test.ts:11 | c: test fixture |
| packages/common/src/codec/risk-codecs.test.ts:12 | c: test fixture |
| packages/common/src/codec/risk-codecs.test.ts:274 | c: test fixture |
| packages/common/src/codec/risk-codecs.test.ts:279 | c: test fixture |
| packages/common/src/codec/risk-codecs.test.ts:283 | c: test fixture |
| packages/common/src/codec/risk-codecs.test.ts:284 | c: test fixture |
| packages/common/src/codec/risk-codecs.test.ts:285 | c: test fixture |
| packages/common/src/codec/risk-codecs.test.ts:286 | c: test fixture |
| packages/common/src/codec/risk-state.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-state.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-state.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/codec/risk-state.ts:58 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:47 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:49 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:66 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:68 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:77 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:79 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:83 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:86 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:92 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:94 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:98 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:100 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:106 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:108 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:115 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:117 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:126 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:129 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:135 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:137 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:145 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:147 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:150 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:152 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:164 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:166 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:173 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:176 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:179 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:181 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:192 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:194 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:210 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:213 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:223 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:226 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:228 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:231 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:233 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.ts:238 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/schemas.test.ts:1 | c: test fixture |
| packages/common/src/api/schemas.test.ts:2 | c: test fixture |
| packages/common/src/api/schemas.test.ts:3 | c: test fixture |
| packages/common/src/api/schemas.test.ts:4 | c: test fixture |
| packages/common/src/api/schemas.test.ts:5 | c: test fixture |
| packages/common/src/api/schemas.test.ts:6 | c: test fixture |
| packages/common/src/api/schemas.test.ts:183 | c: test fixture |
| packages/common/src/api/problem.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/problem.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/problem.ts:23 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/problem.ts:33 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/roles.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/roles.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/money-format.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/common/src/api/money-format.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/pg-journal.test.ts:1 | c: test fixture |
| packages/journal/src/pg-journal.test.ts:2 | c: test fixture |
| packages/journal/src/pg-journal.test.ts:3 | c: test fixture |
| packages/journal/src/pg-journal.test.ts:4 | c: test fixture |
| packages/journal/src/pg-journal.test.ts:5 | c: test fixture |
| packages/journal/src/pg-journal.test.ts:6 | c: test fixture |
| packages/journal/src/pg-journal.test.ts:7 | c: test fixture |
| packages/journal/src/pg-journal.test.ts:8 | c: test fixture |
| packages/journal/src/pg-journal.test.ts:11 | c: test fixture |
| packages/journal/src/pg-journal.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/pg-journal.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/pg-journal.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/pg-journal.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/pg-journal.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/pg-journal.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/fenced.int.test.ts:1 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:2 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:3 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:4 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:5 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:6 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:7 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:18 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:20 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:44 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:94 | c: test fixture |
| packages/journal/src/fenced.int.test.ts:96 | c: test fixture |
| packages/journal/src/recovery.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:38 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:50 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:82 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.ts:246 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/migrate.test.ts:1 | c: test fixture |
| packages/journal/src/migrate.test.ts:2 | c: test fixture |
| packages/journal/src/migrate.test.ts:3 | c: test fixture |
| packages/journal/src/migrate.test.ts:4 | c: test fixture |
| packages/journal/src/migrate.test.ts:5 | c: test fixture |
| packages/journal/src/migrate.test.ts:6 | c: test fixture |
| packages/journal/src/migrate.test.ts:7 | c: test fixture |
| packages/journal/src/migrate.test.ts:10 | c: test fixture |
| packages/journal/src/migrate.test.ts:13 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:1 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:2 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:3 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:4 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:5 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:6 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:7 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:8 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:9 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:12 | c: test fixture |
| packages/journal/src/week11-migrations.int.test.ts:13 | c: test fixture |
| packages/journal/src/spike7.test.ts:1 | c: test fixture |
| packages/journal/src/spike7.test.ts:2 | c: test fixture |
| packages/journal/src/spike7.test.ts:3 | c: test fixture |
| packages/journal/src/spike7.test.ts:4 | c: test fixture |
| packages/journal/src/spike7.test.ts:29 | c: test fixture |
| packages/journal/src/spike7.test.ts:30 | c: test fixture |
| packages/journal/src/snapshot-store.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/snapshot-store.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/snapshot-store.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/snapshot-store.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/snapshot-store.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/postgres.integration.test.ts:1 | c: test fixture |
| packages/journal/src/postgres.integration.test.ts:2 | c: test fixture |
| packages/journal/src/postgres.integration.test.ts:19 | c: test fixture |
| packages/journal/src/order-request-store.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/order-request-store.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/order-request-store.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/order-request-store.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/pool.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/pool.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/pool.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/migration-startup.int.test.ts:1 | c: test fixture |
| packages/journal/src/migration-startup.int.test.ts:2 | c: test fixture |
| packages/journal/src/migration-startup.int.test.ts:3 | c: test fixture |
| packages/journal/src/migration-startup.int.test.ts:4 | c: test fixture |
| packages/journal/src/migration-startup.int.test.ts:7 | c: test fixture |
| packages/journal/src/migration-startup.int.test.ts:8 | c: test fixture |
| packages/journal/src/migration-startup.int.test.ts:10 | c: test fixture |
| packages/journal/src/lease-store.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/lease-store.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/recovery.int.test.ts:1 | c: test fixture |
| packages/journal/src/recovery.int.test.ts:2 | c: test fixture |
| packages/journal/src/recovery.int.test.ts:3 | c: test fixture |
| packages/journal/src/recovery.int.test.ts:4 | c: test fixture |
| packages/journal/src/recovery.int.test.ts:5 | c: test fixture |
| packages/journal/src/recovery.int.test.ts:6 | c: test fixture |
| packages/journal/src/recovery.int.test.ts:7 | c: test fixture |
| packages/journal/src/recovery.int.test.ts:20 | c: test fixture |
| packages/journal/src/recovery.int.test.ts:22 | c: test fixture |
| packages/journal/src/sql-executor.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/sql-executor.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/sql-executor.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/fenced-pg-journal.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/fenced-pg-journal.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/fenced-pg-journal.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/fenced-pg-journal.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/fenced-pg-journal.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/test-schema.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/test-schema.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/test-schema.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/test-schema.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/test-schema.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/test-schema.ts:26 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/test-schema.ts:36 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/index.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/migrate.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/migrate.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/migrate.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/migrate.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/migrate.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/migrate.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/journal/src/pool.test.ts:1 | c: test fixture |
| packages/journal/src/pool.test.ts:2 | c: test fixture |
| packages/journal/src/pool.test.ts:8 | c: test fixture |
| packages/journal/src/pool.test.ts:21 | c: test fixture |
| packages/journal/src/pool.test.ts:22 | c: test fixture |
| packages/journal/migrations/020_verify_replay_support.sql:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:26 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:36 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:55 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.ts:73 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/statement-stream.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/statement-stream.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/statement-stream.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/statement-stream.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/service.test.ts:1 | c: test fixture |
| packages/recon/src/service.test.ts:3 | c: test fixture |
| packages/recon/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/index.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/index.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/index.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/index.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/index.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/index.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/index.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/index.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/persistence/pg-recon-store.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/persistence/pg-recon-store.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/persistence/pg-recon-store.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/persistence/pg-recon-store.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/persistence/pg-recon-store.ts:34 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/persistence/pg-recon-store.ts:45 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/persistence/pg-recon-store.ts:52 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/persistence/pg-recon-store.ts:60 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/persistence/pg-recon-store.test.ts:1 | c: test fixture |
| packages/recon/src/persistence/pg-recon-store.test.ts:2 | c: test fixture |
| packages/recon/src/persistence/pg-recon-store.test.ts:3 | c: test fixture |
| packages/recon/src/persistence/pg-recon-store.test.ts:4 | c: test fixture |
| packages/recon/src/persistence/pg-recon-store.test.ts:5 | c: test fixture |
| packages/recon/src/persistence/pg-recon-store.test.ts:6 | c: test fixture |
| packages/recon/src/persistence/pg-recon-store.test.ts:9 | c: test fixture |
| packages/recon/src/persistence/pg-recon-store.test.ts:20 | c: test fixture |
| packages/recon/src/core/csv.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/csv.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/csv.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/csv.ts:118 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/csv.ts:125 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/recon.contract.test.ts:1 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:3 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:4 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:6 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:7 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:8 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:9 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:74 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:162 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:173 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:187 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:198 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:209 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:220 | c: test fixture |
| packages/recon/src/core/recon.contract.test.ts:231 | c: test fixture |
| packages/recon/src/core/dates.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/dates.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/dates.ts:39 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/matcher.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/matcher.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/matcher.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/matcher.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/matcher.ts:24 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/matcher.ts:38 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/workflow.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/workflow.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/workflow.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/workflow.ts:29 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/in-memory-store.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/in-memory-store.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/recon/src/core/in-memory-store.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-control-plane.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-control-plane.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-control-plane.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-control-plane.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-control-plane.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-control-plane.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-control-plane.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-control-plane.ts:34 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane-redelivery.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane-redelivery.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane-redelivery.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane-redelivery.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane-redelivery.ts:24 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane-redelivery.ts:81 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane-redelivery.int.test.ts:5 | c: test fixture |
| packages/runtime/src/gateway-publisher.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/gateway-publisher.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/gateway-publisher.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/gateway-publisher.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/gateway-publisher.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/wire.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/wire.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/wire.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/wire.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/wire.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:24 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:28 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:29 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:39 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:40 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:47 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:52 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:55 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:56 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.ts:59 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/submit-order.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/submit-order.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/submit-order.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/submit-order.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/submit-order.ts:45 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/submit-order.ts:69 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/submit-order.ts:79 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/submit-order.ts:104 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:34 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/recover-pipeline.ts:52 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane.int.test.ts:5 | c: test fixture |
| packages/runtime/src/control-plane.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/control-plane.ts:62 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/command-routing.int.test.ts:6 | c: test fixture |
| packages/runtime/src/command-routing.int.test.ts:7 | c: test fixture |
| packages/runtime/src/live-runtime.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.ts:26 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/command-router.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/command-router.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/command-router.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/command-router.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/command-router.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/command-router.ts:54 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/command-router.ts:88 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/command-router.ts:122 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/command-router.ts:154 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/live-runtime.int.test.ts:1 | c: test fixture |
| packages/runtime/src/live-runtime.int.test.ts:2 | c: test fixture |
| packages/runtime/src/live-runtime.int.test.ts:3 | c: test fixture |
| packages/runtime/src/live-runtime.int.test.ts:4 | c: test fixture |
| packages/runtime/src/live-runtime.int.test.ts:7 | c: test fixture |
| packages/runtime/src/recover-pipeline.test.ts:1 | c: test fixture |
| packages/runtime/src/recover-pipeline.test.ts:81 | c: test fixture |
| packages/runtime/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/index.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/runtime/src/transport-flag.int.test.ts:2 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:4 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:5 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:7 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:10 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:11 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:15 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:18 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:21 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:22 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:23 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:24 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:26 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:36 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:40 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:42 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:43 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:50 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:51 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:55 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:59 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:60 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:62 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:66 | c: test fixture |
| packages/runtime/src/transport-flag.int.test.ts:69 | c: test fixture |
| packages/runtime/src/ingress.int.test.ts:6 | c: test fixture |
| packages/benchmarks/src/recovery.bench.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/recovery.bench.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/recovery.bench.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/book.bench.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/book.bench.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/book.bench.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/book.bench.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/book.bench.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/book.bench.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/book.bench.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/book.bench.ts:53 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/hello.bench.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/engine.bench.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/engine.bench.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/engine.bench.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/benchmarks/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:30 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:31 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:37 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:46 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:48 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:54 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:70 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:71 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:76 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:82 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:91 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:103 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:124 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:125 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:136 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/driver.ts:163 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/prng.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/prng.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/prng.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/prng.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/prng.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/prng.ts:32 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/prng.ts:40 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/simulator.test.ts:5 | c: test fixture |
| packages/simulator/src/simulator.test.ts:6 | c: test fixture |
| packages/simulator/src/simulator.test.ts:7 | c: test fixture |
| packages/simulator/src/simulator.test.ts:8 | c: test fixture |
| packages/simulator/src/simulator.test.ts:12 | c: test fixture |
| packages/simulator/src/simulator.test.ts:15 | c: test fixture |
| packages/simulator/src/simulator.test.ts:18 | c: test fixture |
| packages/simulator/src/simulator.test.ts:23 | c: test fixture |
| packages/simulator/src/simulator.test.ts:30 | c: test fixture |
| packages/simulator/src/simulator.test.ts:36 | c: test fixture |
| packages/simulator/src/simulator.test.ts:150 | c: test fixture |
| packages/simulator/src/simulator.test.ts:160 | c: test fixture |
| packages/simulator/src/simulator.test.ts:163 | c: test fixture |
| packages/simulator/src/simulator.test.ts:172 | c: test fixture |
| packages/simulator/src/simulator.test.ts:185 | c: test fixture |
| packages/simulator/src/simulator.test.ts:190 | c: test fixture |
| packages/simulator/src/simulator.test.ts:214 | c: test fixture |
| packages/simulator/src/simulator.test.ts:232 | c: test fixture |
| packages/simulator/src/simulator.test.ts:237 | c: test fixture |
| packages/simulator/src/simulator.test.ts:279 | c: test fixture |
| packages/simulator/src/simulator.test.ts:294 | c: test fixture |
| packages/simulator/src/simulator.test.ts:300 | c: test fixture |
| packages/simulator/src/simulator.test.ts:306 | c: test fixture |
| packages/simulator/src/simulator.test.ts:315 | c: test fixture |
| packages/simulator/src/simulator.test.ts:324 | c: test fixture |
| packages/simulator/src/simulator.test.ts:338 | c: test fixture |
| packages/simulator/src/simulator.test.ts:344 | c: test fixture |
| packages/simulator/src/flow-model.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/flow-model.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/flow-model.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/flow-model.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/flow-model.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/flow-model.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/flow-model.ts:31 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/flow-model.ts:32 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/flow-model.ts:37 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/flow-model.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/flow-model.ts:52 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/index.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/simulator/src/index.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos-child.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos-child.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos-child.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos-child.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos-child.ts:28 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos-child.ts:32 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos-child.ts:36 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos-child.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos-child.ts:45 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/wire.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos.test.ts:6 | c: test fixture |
| packages/system-tests/src/chaos.test.ts:7 | c: test fixture |
| packages/system-tests/src/chaos.test.ts:8 | c: test fixture |
| packages/system-tests/src/chaos.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos.ts:32 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos.ts:46 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos.ts:85 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/chaos.ts:108 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/crash-controller.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/crash-controller.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/crash-controller.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/crash-controller.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/system-tests/src/crash-scenarios.test.ts:1 | c: test fixture |
| packages/system-tests/test/persistence-integration.test.ts:1 | c: test fixture |
| packages/system-tests/test/persistence-integration.test.ts:5 | c: test fixture |
| packages/system-tests/test/persistence-integration.test.ts:6 | c: test fixture |
| packages/system-tests/test/persistence-integration.test.ts:9 | c: test fixture |
| packages/system-tests/test/persistence-integration.test.ts:15 | c: test fixture |
| packages/system-tests/test/smoke.test.ts:1 | c: test fixture |
| packages/system-tests/test/smoke.test.ts:3 | c: test fixture |
| packages/system-tests/test/smoke.test.ts:4 | c: test fixture |
| packages/system-tests/test/smoke.test.ts:5 | c: test fixture |
| packages/system-tests/test/smoke.test.ts:6 | c: test fixture |
| packages/system-tests/test/smoke.test.ts:9 | c: test fixture |
| packages/system-tests/test/smoke.test.ts:47 | c: test fixture |
| packages/system-tests/test/smoke.test.ts:63 | c: test fixture |
| packages/system-tests/test/crash-windows.test.ts:1 | c: test fixture |
| packages/system-tests/test/crash-windows.test.ts:2 | c: test fixture |
| packages/system-tests/test/chaos-ingress.int.test.ts:6 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:1 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:2 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:3 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:4 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:5 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:6 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:7 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:11 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:12 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:13 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:35 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:36 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:54 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:56 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:58 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:60 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:79 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:95 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:96 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:97 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:99 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:116 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:129 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:131 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:133 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:134 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:137 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:138 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:139 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:140 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:144 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:171 | c: test fixture |
| packages/system-tests/test/live-stack.int.test.ts:173 | c: test fixture |
| packages/system-tests/test/chaos-scaling.int.test.ts:6 | c: test fixture |
| packages/system-tests/test/chaos-sharding.int.test.ts:7 | c: test fixture |
| packages/system-tests/test/chaos-sharding.int.test.ts:19 | c: test fixture |
| packages/system-tests/test/chaos-sharding.int.test.ts:20 | c: test fixture |
| packages/system-tests/test/chaos-sharding.int.test.ts:21 | c: test fixture |
| packages/system-tests/test/chaos-sharding.int.test.ts:33 | c: test fixture |
| packages/system-tests/test/chaos-sharding.int.test.ts:60 | c: test fixture |
| packages/system-tests/test/chaos-sharding.int.test.ts:65 | c: test fixture |
| packages/system-tests/test/property-kafka.int.test.ts:7 | c: test fixture |
| packages/system-tests/test/property-kafka.int.test.ts:8 | c: test fixture |
| packages/system-tests/test/property-kafka.int.test.ts:14 | c: test fixture |
| packages/system-tests/test/property-kafka.int.test.ts:15 | c: test fixture |
| packages/system-tests/test/property-kafka.int.test.ts:16 | c: test fixture |
| packages/system-tests/test/property-kafka.int.test.ts:24 | c: test fixture |
| packages/system-tests/test/property-kafka.int.test.ts:26 | c: test fixture |
| packages/ledger/src/ledger-catch-up.test.ts:1 | c: test fixture |
| packages/ledger/src/ledger-catch-up.test.ts:2 | c: test fixture |
| packages/ledger/src/pg-ledger-store.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/pg-ledger-store.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/pg-ledger-store.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/pg-ledger-store.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/pg-ledger-store.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/pg-ledger-store.test.ts:1 | c: test fixture |
| packages/ledger/src/pg-ledger-store.test.ts:2 | c: test fixture |
| packages/ledger/src/pg-ledger-store.test.ts:3 | c: test fixture |
| packages/ledger/src/pg-ledger-store.test.ts:4 | c: test fixture |
| packages/ledger/src/pg-ledger-store.test.ts:5 | c: test fixture |
| packages/ledger/src/pg-ledger-store.test.ts:6 | c: test fixture |
| packages/ledger/src/pg-ledger-store.test.ts:7 | c: test fixture |
| packages/ledger/src/pg-ledger-store.test.ts:8 | c: test fixture |
| packages/ledger/src/pg-ledger-store.test.ts:11 | c: test fixture |
| packages/ledger/src/pg-ledger-store.test.ts:22 | c: test fixture |
| packages/ledger/src/ledger.test.ts:1 | c: test fixture |
| packages/ledger/src/ledger.test.ts:2 | c: test fixture |
| packages/ledger/src/tx-id.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/tx-id.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/tx-id.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/tx-id.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/ledger.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/ledger.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/ledger.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/ledger.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/ledger.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/ledger.ts:30 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/ledger.ts:31 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/ledger.ts:33 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/ledger.ts:40 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/ledger.ts:47 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/tx-id.test.ts:1 | c: test fixture |
| packages/ledger/src/tx-id.test.ts:2 | c: test fixture |
| packages/ledger/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/persistence/pg-ledger-store.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/persistence/pg-ledger-store.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/ledger/src/persistence/pg-ledger-store.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/server.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/server.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/server.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/server.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/server.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/server.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/server.ts:38 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/server.ts:39 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/eventloop-sampler.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/eventloop-sampler.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/eventloop-sampler.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/eventloop-sampler.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/eventloop-sampler.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/eventloop-sampler.ts:30 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/index.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/index.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/telemetry.test.ts:5 | c: test fixture |
| packages/telemetry/src/telemetry.test.ts:6 | c: test fixture |
| packages/telemetry/src/registry.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/registry.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/registry.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/registry.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/registry.ts:186 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/registry.ts:214 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/registry.ts:222 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/registry.ts:249 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/registry.ts:281 | UNVERIFIED: production/script value needs semantic classification |
| packages/telemetry/src/registry.ts:308 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/republish.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/republish.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/republish.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/republish.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/republish.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/in-memory-journal.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/in-memory-journal.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:20 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:43 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:50 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.ts:147 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/yield.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/yield.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/stall-watchdog.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/stall-watchdog.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/stall-watchdog.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/stall-watchdog.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/stall-watchdog-worker.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/stall-watchdog-worker.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/ownership-tests.int.test.ts:1 | c: test fixture |
| packages/shard/src/ownership-tests.int.test.ts:2 | c: test fixture |
| packages/shard/src/ownership-tests.int.test.ts:3 | c: test fixture |
| packages/shard/src/ownership-tests.int.test.ts:13 | c: test fixture |
| packages/shard/src/ownership-tests.int.test.ts:15 | c: test fixture |
| packages/shard/src/durable-event-sink.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/durable-event-sink.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:25 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-runner.ts:42 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/republish.int.test.ts:1 | c: test fixture |
| packages/shard/src/republish.int.test.ts:2 | c: test fixture |
| packages/shard/src/republish.int.test.ts:3 | c: test fixture |
| packages/shard/src/republish.int.test.ts:4 | c: test fixture |
| packages/shard/src/republish.int.test.ts:5 | c: test fixture |
| packages/shard/src/republish.int.test.ts:6 | c: test fixture |
| packages/shard/src/republish.int.test.ts:7 | c: test fixture |
| packages/shard/src/republish.int.test.ts:8 | c: test fixture |
| packages/shard/src/republish.int.test.ts:28 | c: test fixture |
| packages/shard/src/republish.int.test.ts:30 | c: test fixture |
| packages/shard/src/ownership-lifecycle.int.test.ts:1 | c: test fixture |
| packages/shard/src/ownership-lifecycle.int.test.ts:2 | c: test fixture |
| packages/shard/src/main.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:22 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:23 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:45 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:102 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:131 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/main.ts:177 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/collecting-sink.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/collecting-sink.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/stamper.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/stamper.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/stamper.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/spike4.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/spike4.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/spike4.ts:87 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/postgres-runner.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/postgres-runner.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/postgres-runner.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/postgres-runner.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/postgres-runner.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/postgres-runner.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/postgres-runner.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/system-clock.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/system-clock.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/offset-tickets.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/offset-tickets.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/tick-injector.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/tick-injector.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/shard-host.test.ts:5 | c: test fixture |
| packages/shard/src/shard-host.test.ts:6 | c: test fixture |
| packages/shard/src/shard-host.test.ts:7 | c: test fixture |
| packages/shard/src/shard-host.test.ts:8 | c: test fixture |
| packages/shard/src/shard-host.test.ts:50 | c: test fixture |
| packages/shard/src/spike4.integration.test.ts:1 | c: test fixture |
| packages/shard/src/spike4.integration.test.ts:2 | c: test fixture |
| packages/shard/src/index.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/index.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/index.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/index.ts:4 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/index.ts:5 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/index.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/index.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/index.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/index.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/src/index.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/test/shard-runner.test.ts:1 | c: test fixture |
| packages/shard/test/shard-runner.test.ts:2 | c: test fixture |
| packages/shard/test/shard-runner.test.ts:3 | c: test fixture |
| packages/shard/test/shard-runner.test.ts:120 | c: test fixture |
| packages/shard/test/helpers.ts:1 | c: test fixture |
| packages/shard/test/helpers.ts:2 | c: test fixture |
| packages/shard/test/helpers.ts:4 | c: test fixture |
| packages/shard/test/helpers.ts:21 | c: test fixture |
| packages/shard/test/helpers.ts:29 | c: test fixture |
| packages/shard/test/helpers.ts:37 | c: test fixture |
| packages/shard/test/helpers.ts:56 | c: test fixture |
| packages/shard/test/helpers.ts:60 | c: test fixture |
| packages/shard/test/tick-injector.test.ts:1 | c: test fixture |
| packages/shard/test/tick-injector.test.ts:2 | c: test fixture |
| packages/shard/test/tick-injector.test.ts:3 | c: test fixture |
| packages/shard/test/tick-injector.test.ts:4 | c: test fixture |
| packages/shard/test/tick-injector.test.ts:5 | c: test fixture |
| packages/shard/test/tick-injector.test.ts:6 | c: test fixture |
| packages/shard/test/chaos.test.ts:1 | c: test fixture |
| packages/shard/test/chaos.test.ts:5 | c: test fixture |
| packages/shard/test/runner.properties.test.ts:1 | c: test fixture |
| packages/shard/test/runner.properties.test.ts:2 | c: test fixture |
| packages/shard/test/runner.properties.test.ts:3 | c: test fixture |
| packages/shard/test/runner.properties.test.ts:4 | c: test fixture |
| packages/shard/test/runner.properties.test.ts:5 | c: test fixture |
| packages/shard/test/runner.recovery.test.ts:1 | c: test fixture |
| packages/shard/test/runner.recovery.test.ts:2 | c: test fixture |
| packages/shard/test/runner.recovery.test.ts:3 | c: test fixture |
| packages/shard/test/runner.recovery.test.ts:4 | c: test fixture |
| packages/shard/test/runner.recovery.test.ts:5 | c: test fixture |
| packages/shard/test/runner.recovery.test.ts:6 | c: test fixture |
| packages/shard/test/runner.recovery.test.ts:7 | c: test fixture |
| packages/shard/dist-test/shard-runner.test.js:1 | c: test fixture |
| packages/shard/dist-test/shard-runner.test.js:2 | c: test fixture |
| packages/shard/dist-test/shard-runner.test.js:3 | c: test fixture |
| packages/shard/dist-test/shard-runner.test.js:101 | c: test fixture |
| packages/shard/dist-test/helpers.d.ts:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.d.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.d.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.d.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.d.ts:11 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.d.ts:12 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.d.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.d.ts:14 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/shard-runner.test.d.ts:1 | c: test fixture |
| packages/shard/dist-test/chaos.test.js:1 | c: test fixture |
| packages/shard/dist-test/chaos.test.js:4 | c: test fixture |
| packages/shard/dist-test/runner.recovery.test.d.ts:1 | c: test fixture |
| packages/shard/dist-test/runner.properties.test.js:1 | c: test fixture |
| packages/shard/dist-test/runner.properties.test.js:2 | c: test fixture |
| packages/shard/dist-test/runner.properties.test.js:3 | c: test fixture |
| packages/shard/dist-test/runner.properties.test.js:4 | c: test fixture |
| packages/shard/dist-test/tick-injector.test.js:1 | c: test fixture |
| packages/shard/dist-test/tick-injector.test.js:2 | c: test fixture |
| packages/shard/dist-test/tick-injector.test.js:3 | c: test fixture |
| packages/shard/dist-test/tick-injector.test.js:4 | c: test fixture |
| packages/shard/dist-test/tick-injector.test.js:5 | c: test fixture |
| packages/shard/dist-test/tick-injector.test.js:6 | c: test fixture |
| packages/shard/dist-test/runner.recovery.test.js:1 | c: test fixture |
| packages/shard/dist-test/runner.recovery.test.js:2 | c: test fixture |
| packages/shard/dist-test/runner.recovery.test.js:3 | c: test fixture |
| packages/shard/dist-test/runner.recovery.test.js:4 | c: test fixture |
| packages/shard/dist-test/runner.recovery.test.js:5 | c: test fixture |
| packages/shard/dist-test/runner.recovery.test.js:6 | c: test fixture |
| packages/shard/dist-test/tick-injector.test.d.ts:1 | c: test fixture |
| packages/shard/dist-test/runner.properties.test.d.ts:1 | c: test fixture |
| packages/shard/dist-test/chaos.test.d.ts:1 | c: test fixture |
| packages/shard/dist-test/helpers.js:1 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.js:17 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.js:24 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.js:31 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.js:44 | UNVERIFIED: production/script value needs semantic classification |
| packages/shard/dist-test/helpers.js:47 | UNVERIFIED: production/script value needs semantic classification |
| web/vite.config.ts:1 | a: config/default declaration |
| web/vite.config.ts:2 | a: config/default declaration |
| web/vite.config.ts:4 | a: config/default declaration |
| web/vite.config.ts:7 | a: config/default declaration |
| web/vite.config.ts:9 | a: config/default declaration |
| web/vite.config.ts:11 | a: config/default declaration |
| web/vitest.config.ts:1 | a: config/default declaration |
| web/vitest.config.ts:2 | a: config/default declaration |
| web/vitest.config.ts:3 | a: config/default declaration |
| web/vitest.config.ts:5 | a: config/default declaration |
| web/vitest.config.ts:7 | a: config/default declaration |
| web/src/App.tsx:1 | UNVERIFIED: production/script value needs semantic classification |
| web/src/App.tsx:2 | UNVERIFIED: production/script value needs semantic classification |
| web/src/App.tsx:3 | UNVERIFIED: production/script value needs semantic classification |
| web/src/App.tsx:4 | UNVERIFIED: production/script value needs semantic classification |
| web/src/App.tsx:5 | UNVERIFIED: production/script value needs semantic classification |
| web/src/App.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/App.tsx:10 | UNVERIFIED: production/script value needs semantic classification |
| web/src/main.tsx:1 | UNVERIFIED: production/script value needs semantic classification |
| web/src/main.tsx:2 | UNVERIFIED: production/script value needs semantic classification |
| web/src/main.tsx:3 | UNVERIFIED: production/script value needs semantic classification |
| web/src/main.tsx:4 | UNVERIFIED: production/script value needs semantic classification |
| web/src/config-defaults.ts:1 | a: config/default declaration |
| web/src/router.tsx:5 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:9 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:10 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:11 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:12 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:13 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:14 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:15 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:16 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:17 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:33 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:79 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:81 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:108 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:110 | UNVERIFIED: production/script value needs semantic classification |
| web/src/router.tsx:111 | UNVERIFIED: production/script value needs semantic classification |
| web/src/config.ts:1 | a: config/default declaration |
| web/src/config.ts:2 | a: config/default declaration |
| web/src/config.ts:4 | a: config/default declaration |
| web/src/config.ts:5 | a: config/default declaration |
| web/src/config.ts:6 | a: config/default declaration |
| web/src/config.ts:9 | a: config/default declaration |
| web/src/config.ts:14 | a: config/default declaration |
| web/src/config.test.ts:1 | c: test fixture |
| web/src/config.test.ts:2 | c: test fixture |
| web/src/config.test.ts:3 | c: test fixture |
| web/src/config.test.ts:8 | c: test fixture |
| web/src/config.test.ts:10 | c: test fixture |
| web/src/config.test.ts:13 | c: test fixture |
| web/src/vite-env.d.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| web/src/vite-env.d.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/vite-env.d.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| web/src/vite-env.d.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| web/test/setup.ts:1 | c: test fixture |
| web/test/setup.ts:2 | c: test fixture |
| web/test/setup.ts:3 | c: test fixture |
| web/src/ws/useSocket.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/ws/useSocket.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/ws/useSocket.ts:10 | UNVERIFIED: production/script value needs semantic classification |
| web/src/ws/useSocket.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| web/src/ws/useSocket.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| web/src/ws/useSocket.ts:23 | UNVERIFIED: production/script value needs semantic classification |
| web/src/ws/useSocket.ts:27 | UNVERIFIED: production/script value needs semantic classification |
| web/src/ws/useSocket.ts:37 | UNVERIFIED: production/script value needs semantic classification |
| web/src/ws/useSocket.ts:53 | UNVERIFIED: production/script value needs semantic classification |
| web/src/lib/money-eslint.test.ts:6 | c: test fixture |
| web/src/lib/money-eslint.test.ts:7 | c: test fixture |
| web/src/lib/money-eslint.test.ts:8 | c: test fixture |
| web/src/lib/money-eslint.test.ts:9 | c: test fixture |
| web/src/lib/money.test.ts:1 | c: test fixture |
| web/src/lib/money.test.ts:2 | c: test fixture |
| web/src/lib/lifecycle.test.ts:5 | c: test fixture |
| web/src/lib/lifecycle.test.ts:6 | c: test fixture |
| web/src/lib/lifecycle.test.ts:7 | c: test fixture |
| web/src/lib/lifecycle.test.ts:29 | c: test fixture |
| web/src/lib/lifecycle.test.ts:46 | c: test fixture |
| web/src/lib/lifecycle.test.ts:48 | c: test fixture |
| web/src/lib/lifecycle.ts:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/lib/lifecycle.ts:15 | UNVERIFIED: production/script value needs semantic classification |
| web/src/lib/lifecycle.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| web/src/lib/lifecycle.ts:18 | UNVERIFIED: production/script value needs semantic classification |
| web/src/lib/lifecycle.ts:28 | UNVERIFIED: production/script value needs semantic classification |
| web/src/lib/lifecycle.ts:39 | UNVERIFIED: production/script value needs semantic classification |
| web/src/lib/lifecycle.ts:47 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:1 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:2 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:3 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:5 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:11 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:15 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:21 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:66 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:67 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:87 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/AuthProvider.tsx:93 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/auth.test.ts:1 | c: test fixture |
| web/src/auth/auth.test.ts:2 | c: test fixture |
| web/src/auth/auth.test.ts:3 | c: test fixture |
| web/src/auth/auth.test.ts:16 | c: test fixture |
| web/src/auth/token-store.ts:9 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/token-store.ts:16 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/token-store.ts:24 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/token-store.ts:32 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/token-store.ts:41 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/token-store.ts:50 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/guards.tsx:1 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/guards.tsx:2 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/guards.tsx:3 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/guards.tsx:4 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/guards.tsx:11 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/guards.tsx:26 | UNVERIFIED: production/script value needs semantic classification |
| web/src/auth/guards.tsx:31 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Risk.tsx:5 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Risk.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Risk.tsx:25 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Risk.tsx:72 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Risk.tsx:78 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:9 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:10 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:11 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:12 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:13 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:15 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:20 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:27 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Trading.tsx:34 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Recon.test.tsx:8 | c: test fixture |
| web/src/pages/Recon.test.tsx:9 | c: test fixture |
| web/src/pages/Recon.test.tsx:10 | c: test fixture |
| web/src/pages/Recon.test.tsx:11 | c: test fixture |
| web/src/pages/Recon.test.tsx:12 | c: test fixture |
| web/src/pages/Recon.test.tsx:13 | c: test fixture |
| web/src/pages/Recon.test.tsx:14 | c: test fixture |
| web/src/pages/Portfolio.tsx:2 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Portfolio.tsx:5 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Portfolio.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Portfolio.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Portfolio.tsx:33 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Portfolio.tsx:62 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Portfolio.tsx:77 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Portfolio.tsx:78 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Portfolio.tsx:91 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Portfolio.tsx:100 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/System.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/System.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/System.tsx:51 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/System.tsx:116 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/System.tsx:122 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/OrderDetail.test.tsx:4 | c: test fixture |
| web/src/pages/OrderDetail.test.tsx:5 | c: test fixture |
| web/src/pages/OrderDetail.test.tsx:6 | c: test fixture |
| web/src/pages/OrderDetail.test.tsx:7 | c: test fixture |
| web/src/pages/OrderDetail.test.tsx:8 | c: test fixture |
| web/src/pages/OrderDetail.test.tsx:9 | c: test fixture |
| web/src/pages/Dashboard.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Dashboard.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Dashboard.tsx:13 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Dashboard.tsx:18 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Dashboard.tsx:23 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Dashboard.tsx:34 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Dashboard.tsx:38 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.test.tsx:1 | c: test fixture |
| web/src/pages/Login.test.tsx:5 | c: test fixture |
| web/src/pages/Login.test.tsx:6 | c: test fixture |
| web/src/pages/Login.test.tsx:7 | c: test fixture |
| web/src/pages/Login.test.tsx:8 | c: test fixture |
| web/src/pages/Login.test.tsx:9 | c: test fixture |
| web/src/pages/Login.test.tsx:10 | c: test fixture |
| web/src/pages/Login.test.tsx:11 | c: test fixture |
| web/src/pages/Login.test.tsx:29 | c: test fixture |
| web/src/pages/Login.test.tsx:62 | c: test fixture |
| web/src/pages/Login.test.tsx:69 | c: test fixture |
| web/src/pages/Login.test.tsx:77 | c: test fixture |
| web/src/pages/Login.test.tsx:80 | c: test fixture |
| web/src/pages/OrderDetail.tsx:5 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/OrderDetail.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/OrderDetail.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/OrderDetail.tsx:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/OrderDetail.tsx:9 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/OrderDetail.tsx:10 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/OrderDetail.tsx:11 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/OrderDetail.tsx:25 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Risk.test.tsx:8 | c: test fixture |
| web/src/pages/Risk.test.tsx:9 | c: test fixture |
| web/src/pages/Risk.test.tsx:10 | c: test fixture |
| web/src/pages/Risk.test.tsx:11 | c: test fixture |
| web/src/pages/Risk.test.tsx:12 | c: test fixture |
| web/src/pages/Risk.test.tsx:13 | c: test fixture |
| web/src/pages/System.test.tsx:8 | c: test fixture |
| web/src/pages/System.test.tsx:9 | c: test fixture |
| web/src/pages/System.test.tsx:10 | c: test fixture |
| web/src/pages/System.test.tsx:11 | c: test fixture |
| web/src/pages/System.test.tsx:12 | c: test fixture |
| web/src/pages/System.test.tsx:13 | c: test fixture |
| web/src/pages/System.test.tsx:106 | c: test fixture |
| web/src/pages/Login.tsx:3 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:9 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:20 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:26 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:39 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:82 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:94 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:95 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:96 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Login.tsx:119 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Recon.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Recon.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Recon.tsx:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Recon.tsx:33 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Recon.tsx:76 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Recon.tsx:82 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/SignUp.tsx:3 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/SignUp.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/SignUp.tsx:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/pages/Portfolio.test.tsx:2 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:4 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:5 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:6 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:7 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:8 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:9 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:11 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:17 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:23 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:52 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:75 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:82 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:88 | c: test fixture |
| web/src/pages/Portfolio.test.tsx:105 | c: test fixture |
| web/src/pages/Trading.test.tsx:1 | c: test fixture |
| web/src/pages/Trading.test.tsx:6 | c: test fixture |
| web/src/pages/Trading.test.tsx:7 | c: test fixture |
| web/src/pages/Trading.test.tsx:8 | c: test fixture |
| web/src/pages/Trading.test.tsx:9 | c: test fixture |
| web/src/pages/Trading.test.tsx:10 | c: test fixture |
| web/src/pages/Trading.test.tsx:11 | c: test fixture |
| web/src/pages/Trading.test.tsx:12 | c: test fixture |
| web/src/utils/display-money.ts:2 | UNVERIFIED: production/script value needs semantic classification |
| web/src/utils/money.test.ts:5 | c: test fixture |
| web/src/utils/money.test.ts:6 | c: test fixture |
| web/src/utils/money.test.ts:7 | c: test fixture |
| web/src/utils/money.ts:3 | UNVERIFIED: production/script value needs semantic classification |
| web/src/utils/money.ts:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/utils/money.ts:13 | UNVERIFIED: production/script value needs semantic classification |
| web/src/utils/money.ts:40 | UNVERIFIED: production/script value needs semantic classification |
| web/src/utils/money.ts:49 | UNVERIFIED: production/script value needs semantic classification |
| web/src/utils/money.ts:70 | UNVERIFIED: production/script value needs semantic classification |
| web/src/utils/money.ts:88 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OrderEntry.test.tsx:1 | c: test fixture |
| web/src/components/OrderEntry.test.tsx:7 | c: test fixture |
| web/src/components/OrderEntry.test.tsx:12 | c: test fixture |
| web/src/components/OrderEntry.test.tsx:13 | c: test fixture |
| web/src/components/OrderEntry.test.tsx:14 | c: test fixture |
| web/src/components/OrderEntry.test.tsx:16 | c: test fixture |
| web/src/components/LifecycleStrip.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/LifecycleStrip.tsx:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/LifecycleStrip.tsx:9 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/LifecycleStrip.tsx:16 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/LifecycleStrip.tsx:23 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OrderEntry.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OrderEntry.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OrderEntry.tsx:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OrderEntry.tsx:9 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OrderEntry.tsx:10 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OrderEntry.tsx:18 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/Toast.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/Toast.tsx:26 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/Toast.tsx:85 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/Toast.tsx:92 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/forms.test.ts:3 | c: test fixture |
| web/src/components/forms.test.ts:10 | c: test fixture |
| web/src/components/forms.test.ts:11 | c: test fixture |
| web/src/components/forms.test.ts:14 | c: test fixture |
| web/src/components/OpenOrders.tsx:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OpenOrders.tsx:7 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OpenOrders.tsx:8 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OpenOrders.tsx:9 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OpenOrders.tsx:10 | UNVERIFIED: production/script value needs semantic classification |
| web/src/components/OpenOrders.tsx:18 | UNVERIFIED: production/script value needs semantic classification |
| web/src/api/client.ts:6 | UNVERIFIED: production/script value needs semantic classification |
| web/src/api/client.ts:17 | UNVERIFIED: production/script value needs semantic classification |
| web/src/api/client.ts:31 | UNVERIFIED: production/script value needs semantic classification |
| web/src/api/client.ts:37 | UNVERIFIED: production/script value needs semantic classification |
| web/src/state/stream.test.ts:5 | c: test fixture |
| web/src/state/stream.test.ts:6 | c: test fixture |
| web/src/state/stream.test.ts:7 | c: test fixture |
| web/src/state/stream.test.ts:8 | c: test fixture |
| web/src/state/stream.test.ts:9 | c: test fixture |
| web/src/state/stream.test.ts:134 | c: test fixture |
| web/src/state/stream.test.ts:165 | c: test fixture |
| web/src/state/stream.test.ts:195 | c: test fixture |
| web/src/state/stream.test.ts:225 | c: test fixture |
| web/src/state/stream.test.ts:249 | c: test fixture |
| web/src/state/stream-state.ts:19 | UNVERIFIED: production/script value needs semantic classification |
| web/src/state/stream-state.ts:21 | UNVERIFIED: production/script value needs semantic classification |
| web/src/state/stream-state.ts:29 | UNVERIFIED: production/script value needs semantic classification |
| web/src/state/stream-state.ts:33 | UNVERIFIED: production/script value needs semantic classification |
| web/src/state/stream-state.ts:39 | UNVERIFIED: production/script value needs semantic classification |
| web/src/state/stream-state.ts:45 | UNVERIFIED: production/script value needs semantic classification |
| web/src/state/stream-state.ts:50 | UNVERIFIED: production/script value needs semantic classification |
| web/src/state/stream-state.ts:62 | UNVERIFIED: production/script value needs semantic classification |
| scripts/create-topics.mjs:9 | UNVERIFIED: production/script value needs semantic classification |
| scripts/create-topics.mjs:12 | UNVERIFIED: production/script value needs semantic classification |
| scripts/create-topics.mjs:15 | UNVERIFIED: production/script value needs semantic classification |
| scripts/create-topics.mjs:75 | UNVERIFIED: production/script value needs semantic classification |
| scripts/create-topics.mjs:85 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-no-placeholders.mjs:2 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-no-placeholders.mjs:3 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-no-placeholders.mjs:4 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-no-placeholders.mjs:53 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:1 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:2 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:3 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:4 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:5 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:6 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:7 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:8 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:9 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:10 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:15 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:16 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:18 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:29 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:30 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:33 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:44 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:45 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:51 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:55 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-empty-pages.mjs:60 | UNVERIFIED: production/script value needs semantic classification |
| scripts/rebuild-projections.mjs:7 | UNVERIFIED: production/script value needs semantic classification |
| scripts/rebuild-projections.mjs:8 | UNVERIFIED: production/script value needs semantic classification |
| scripts/rebuild-projections.mjs:13 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:26 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:27 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:28 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:29 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:31 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:39 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:47 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:219 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:223 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:237 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:267 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:269 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:273 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:284 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:289 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:340 | UNVERIFIED: production/script value needs semantic classification |
| scripts/mutate.mjs:369 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e2-scaling.mjs:8 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e2-scaling.mjs:13 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e2-scaling.mjs:14 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e2-scaling.mjs:18 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e2-scaling.mjs:49 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:4 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:8 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:10 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:14 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:15 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:16 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:17 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:154 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:157 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:160 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:164 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:172 | UNVERIFIED: production/script value needs semantic classification |
| scripts/seed-demo.mjs:178 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.test.mjs:9 | c: test fixture |
| scripts/check-boundaries.test.mjs:10 | c: test fixture |
| scripts/check-boundaries.test.mjs:12 | c: test fixture |
| scripts/check-boundaries.test.mjs:74 | c: test fixture |
| scripts/check-boundaries.test.mjs:94 | c: test fixture |
| scripts/check-boundaries.test.mjs:108 | c: test fixture |
| scripts/check-no-placeholders.test.ts:12 | c: test fixture |
| scripts/check-no-placeholders.test.ts:13 | c: test fixture |
| scripts/check-no-placeholders.test.ts:14 | c: test fixture |
| scripts/check-no-placeholders.test.ts:15 | c: test fixture |
| scripts/check-no-placeholders.test.ts:47 | c: test fixture |
| scripts/chaos-pipeline.mjs:2 | UNVERIFIED: production/script value needs semantic classification |
| scripts/chaos-pipeline.mjs:3 | UNVERIFIED: production/script value needs semantic classification |
| scripts/chaos-pipeline.mjs:8 | UNVERIFIED: production/script value needs semantic classification |
| scripts/chaos-pipeline.mjs:9 | UNVERIFIED: production/script value needs semantic classification |
| scripts/chaos-pipeline.mjs:17 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-dashboard-metrics.mjs:7 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-dashboard-metrics.mjs:8 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-dashboard-metrics.mjs:10 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-dashboard-metrics.mjs:72 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-dashboard-metrics.test.ts:8 | c: test fixture |
| scripts/check-dashboard-metrics.test.ts:9 | c: test fixture |
| scripts/check-dashboard-metrics.test.ts:10 | c: test fixture |
| scripts/check-dashboard-metrics.test.ts:11 | c: test fixture |
| scripts/flake-gate.mjs:1 | UNVERIFIED: production/script value needs semantic classification |
| scripts/flake-gate.mjs:2 | UNVERIFIED: production/script value needs semantic classification |
| scripts/flake-gate.mjs:3 | UNVERIFIED: production/script value needs semantic classification |
| scripts/flake-gate.mjs:5 | UNVERIFIED: production/script value needs semantic classification |
| scripts/flake-gate.mjs:71 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.test.ts:3 | c: test fixture |
| scripts/check-boundaries.test.ts:6 | c: test fixture |
| scripts/check-boundaries.test.ts:7 | c: test fixture |
| scripts/check-boundaries.test.ts:10 | c: test fixture |
| scripts/e1-sharding.mjs:16 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e1-sharding.mjs:18 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e1-sharding.mjs:25 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e1-sharding.mjs:35 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e1-sharding.mjs:40 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e1-sharding.mjs:51 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e1-sharding.mjs:96 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e1-sharding.mjs:99 | UNVERIFIED: production/script value needs semantic classification |
| scripts/e1-sharding.mjs:106 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:1 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:2 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:3 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:4 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:5 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:6 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:13 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:16 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:18 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:19 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:22 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:26 | UNVERIFIED: production/script value needs semantic classification |
| scripts/verify-page-visibility.mjs:28 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.mjs:1 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.mjs:2 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.mjs:10 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.mjs:11 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.mjs:16 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.mjs:17 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.mjs:54 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.mjs:55 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.mjs:69 | UNVERIFIED: production/script value needs semantic classification |
| scripts/check-boundaries.mjs:70 | UNVERIFIED: production/script value needs semantic classification |
| ops/grafana/provisioning/datasources/prometheus.yml:7 | a: config/default declaration |

## Credential-like assignments

| Location | Classification |
|---|---|
| packages/api/src/test-helpers.ts:220 | legitimate test-helper credential fixture; value redacted |
| packages/api/src/config.test.ts:45 | test fixture |
| packages/api/src/config.test.ts:60 | test fixture |
| packages/api/src/week11-live.int.test.ts:15 | test fixture |
| packages/api/src/live-verification.int.test.ts:25 | test fixture |
| packages/api/src/ws/gateway.test.ts:12 | test fixture |
| packages/api/src/ws/gateway.test.ts:79 | test fixture |
| packages/api/src/auth/passwords.test.ts:10 | test fixture |
| packages/api/src/auth/passwords.test.ts:31 | test fixture |
| packages/api/src/routes/admin.test.ts:30 | test fixture |
| packages/api/src/routes/admin.test.ts:61 | test fixture |
| packages/api/src/routes/admin.test.ts:71 | test fixture |
| packages/api/src/routes/admin.test.ts:79 | test fixture |
| packages/common/src/ui-schemas.test.ts:18 | test fixture |
| packages/common/src/ui-schemas.test.ts:21 | test fixture |
| packages/common/src/ui-schemas.test.ts:27 | test fixture |
| packages/system-tests/test/live-stack.int.test.ts:96 | test fixture |
| packages/system-tests/test/live-stack.int.test.ts:99 | test fixture |
| packages/system-tests/test/live-stack.int.test.ts:139 | test fixture |
| packages/system-tests/test/live-stack.int.test.ts:144 | test fixture |
| web/src/pages/Login.test.tsx:50 | test fixture |
| web/src/pages/Login.test.tsx:62 | test fixture |
| web/src/state/stream.test.ts:166 | test fixture |
| web/src/state/stream.test.ts:182 | test fixture |
| web/src/state/stream.test.ts:196 | test fixture |
| web/src/state/stream.test.ts:226 | test fixture |
| web/src/state/stream.test.ts:250 | test fixture |
| scripts/verify-empty-pages.mjs:29 | legitimate isolated verification credential fixture; value redacted |
| scripts/seed-demo.mjs:14 | demo seed/profile |
| scripts/seed-demo.mjs:15 | demo seed/profile |
| scripts/seed-demo.mjs:16 | demo seed/profile |
| scripts/seed-demo.mjs:17 | demo seed/profile |
| scripts/seed-demo.mjs:164 | demo seed/profile |

## Production fixture/sample/file reads

| Location | Status |
|---|---|
| scripts/mutate.mjs:35 | mutation catalogue JSON read by developer tooling, not a production response fixture |

## Targeted semantic follow-up

The original candidate rows above are a static scan snapshot and are not a completed semantic audit. These follow-up changes address the specific reviewed findings:

| Finding | Current disposition | Evidence |
|---|---|---|
| Hardcoded five-minute risk countdown | Removed; UI now displays elapsed incident duration from the backend timestamp | `web/src/pages/Risk.tsx`; test `UP11` |
| Repeated 5000 ms Risk/Recon/System polling | Consolidated to validated `VITE_POLL_INTERVAL_MS`, defaulted in `web/src/config-defaults.ts` | `web/src/config.ts`; test `validated pending hint configuration` |
| Default JWT signing key in exported API builder | Removed; builder requires a supplied or environment secret at least 32 bytes | `packages/api/src/index.ts`; test `requires an explicit JWT secret of at least 32 bytes` |
| Shard zod range | Pinned exactly to `3.25.76`; lock entry matches | `packages/shard/package.json`, `package-lock.json` |
| Projector lag name | API helper, catalogue and dashboard now use `ml_projector_lag` (sequence lag) | `packages/api/src/metrics.ts`, `packages/telemetry/src/registry.ts`, Grafana dashboard |
| Pending lifecycle hint default | Corrected from 3000 ms to the spec's 10000 ms; remains env-overridable and validated | `docs/week-11.md:313`, `web/src/config-defaults.ts`, `web/src/config.test.ts` |
| Example JWT signing key | Removed the known example key from the tracked template; ignored local `.env` key was rotated | `.env.example`, `.env` (ignored by `.gitignore:5`) |
| Projector lag state thresholds | Replaced inline thresholds with named, single-definition constants; these are policy constants, not environment settings in the Week 11 config list | `packages/api/src/routes/system.ts` |
| Dependency advisories | Patched Fastify, Vitest, happy-dom and fast-uri; upgraded shard Zod 3→4.6.7 to clear the high advisory; 10 moderate ESLint-toolchain advisories remain because npm's suggested remediation is a breaking downgrade | `docs/versions.md` |

The source scripts named in the original evidence header are not present in `/tmp` now. The retained static inventory has 1,588 rows still marked `UNVERIFIED` across 232 source files; those are not semantically classified here. The targeted review above covers the settings and security-related candidates traced during this pass, but it does not prove absence of other hardcoded values or dynamically assembled secrets. The exhaustive semantic classification remains UNVERIFIED.
