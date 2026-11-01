# Deployment

The production stack layers `deploy/docker-compose.prod.yml` on the repository's
`docker-compose.yml`. It keeps data in named volumes, publishes only the Caddy
proxy, creates Kafka topics before starting the API or shards, and obtains TLS
certificates through Caddy.

`topic-init` is a one-shot dependency: API and shard startup waits for its
successful completion. It uses `restart: "no"` and Compose's
`service_completed_successfully` condition; a long-running healthcheck is not
meaningful for a completed job. Every long-running service has a healthcheck
and `restart: unless-stopped`.

## Prepare the host

Install Docker Engine with the Compose plugin, point the chosen public DNS name
at the host, and allow inbound TCP ports 80 and 443 (plus UDP 443 for HTTP/3).
The public origin is a hostname only; do not include a scheme or path.

From the repository root:

```sh
cp deploy/.env.example deploy/.env
openssl rand -hex 32
```

Paste separately generated values into `POSTGRES_PASSWORD`, `JWT_SECRET`, and
`GRAFANA_ADMIN_PASSWORD` in `deploy/.env`. Set `PUBLIC_ORIGIN` to the DNS name.
Keep `deploy/.env` private; it is excluded from Docker build contexts.

## Deploy

```sh
bash deploy/deploy.sh
```

The script validates the merged Compose configuration, records the running API
image tag, builds, starts the stack with health checks, and runs the black-box
smoke test against `https://PUBLIC_ORIGIN`. If validation, build, startup, or
smoke fails, it starts the previous image tag and smoke-checks the rollback.
The script returns failure even when rollback succeeds, so the failed release
is visible to its caller.

To inspect the merged production configuration:

```sh
docker compose --env-file deploy/.env -f docker-compose.yml -f deploy/docker-compose.prod.yml config
```

To inspect service state and logs:

```sh
docker compose --env-file deploy/.env -f docker-compose.yml -f deploy/docker-compose.prod.yml ps
docker compose --env-file deploy/.env -f docker-compose.yml -f deploy/docker-compose.prod.yml logs --tail=100
```

`APP_IMAGE_TAG` can be set in the environment for a release. If omitted, the
script uses the current short Git revision. `DEPLOY_ENV_FILE` can point at a
separate deployment environment file. `SMOKE_URL` can override the public URL
when running a controlled smoke probe.

## Rollback probe

```sh
bash deploy/test-rollback.sh
```

This isolated DP9 harness checks both a deliberately failing build and a
successfully built but unhealthy image that reuses the previous tag. It checks
that rollback restores the previous image ID and invokes the rollback smoke
command. It substitutes local Node images and a test-only smoke wrapper; it
does not exercise an actual external deployment or the live smoke checks. It
does not modify or start the production stack.

## Render: single-instance demo API

Use the repository root as the Render service root. Build with `npm ci --include=dev && npm run build` and start with `npm run api:start`. The server entry point is `packages/api/dist/main.js`; `packages/api/dist/index.js` exports an app factory and does not start a listener.

Configure the service environment:

- `DATABASE_URL`: the connection URL of your reachable Postgres database (prefer Render's internal database URL for a service in the same region).
- `JWT_SECRET`: your existing strong signing secret. Never put it in Vercel's `VITE_*` environment.
- `PROFILE=demo`: seeds demo accounts. The simulator stays stopped until an administrator starts it from System.
- `TRANSPORT=inproc`: runs the matching component in this API process. Kafka mode requires separately running Kafka and shard services.
- `METRICS_HOST=127.0.0.1`: keeps metrics private to the service.

Keep Render's provided `PORT`; the API listens on `0.0.0.0`. Set Render's Health Check Path to `/healthz`. It is available after recovery and projection catch-up, returns ready only when a database query succeeds, and exposes no account data. `/system/health` requires authentication and is unsuitable as Render's unauthenticated health check.

The API now logs startup phases: database connection, exclusive runtime ownership, migrations, journal recovery, demo account seed, projection catch-up, routes, and listeners. `DB_CONNECT_TIMEOUT_MS` limits pool acquisition/connection waits; `DB_STATEMENT_TIMEOUT_MS` limits database statement execution; `API_STARTUP_TIMEOUT_MS` bounds CLI startup as a whole. Each is a validated positive integer with a default in `packages/api/src/startup-config.ts`. A timeout exits with an error instead of leaving the deployment indefinitely starting. Large journal recoveries may need a larger startup deadline.

Run exactly one API against each database. The advisory lock deliberately refuses a second owner; a rolling deployment overlapping the old API can therefore fail. Stop the old service before starting its replacement if logs report another owner. Do not bypass that lock or erase the journal to deploy.

After deployment, request `/healthz` on the actual Render service URL and confirm JSON with `status: ready`, then verify demo login and WebSocket authentication. Vercel's `/api/v1` rewrite and `VITE_WS_URL` must use that same verified service hostname. Local checks cannot certify a remote database URL or Render service state.

### Render ownership conflict during overlapping deployment

The API waits up to `API_OWNERSHIP_WAIT_MS` (default 120000), retrying every `API_OWNERSHIP_RETRY_MS` (default 1000), for the previous database owner to finish. Both settings are validated positive integers; ownership wait must be below `API_STARTUP_TIMEOUT_MS`. Recovery and application writes start only after acquiring the lock. It never terminates or steals another database session.

This bounded wait handles a previous process that is already shutting down. It cannot resolve Render's overlapping-deployment lifecycle by itself: Render keeps the old instance alive until the replacement passes readiness, while this single-writer API cannot become ready until the old owner stops. See https://render.com/articles/how-render-handles-zero-downtime-deploys.

For an existing conflicted deployment, cancel the pending deploy, suspend the old service and wait for it to stop, then resume and deploy the latest commit. Confirm there is only one Render service connected to that application database. Keep `/healthz` as the health check; do not fake readiness or remove ownership checks. Expect downtime for this stop/start deployment. An attached Render persistent disk disables overlapping deploys, but requires an intentional hosting configuration/plan change; it is not needed for storing this application's PostgreSQL data.

## Render demo with private local Prometheus

For a free Render web service, use `deploy/Dockerfile.render` (repository root build context). It bundles the pinned Prometheus binary and launches it with the API in the same container, scraping only the API metrics port on loopback. Both Prometheus and the API metrics listener bind to `127.0.0.1`; the API remains the only public listener. Metrics history is kept in `/tmp` and is lost on service restarts. This deployment has a 2-hour retention limit and allocates Node a 384 MiB heap; the free plan's 512 MiB total memory limit also includes Prometheus and native memory, so resource use must be observed on the actual workload.

Do not point this combined container at a separately deployed Prometheus: the launcher intentionally sets `PROMETHEUS_URL=http://127.0.0.1:9090` and `METRICS_HOST=127.0.0.1`. Preserve the existing `DATABASE_URL`, `JWT_SECRET`, `PROFILE=demo`, and `TRANSPORT=inproc`. A deployment with a single-writer database requires the previous API instance to stop first. On Render, resuming the old service can restart the old version and cause an overlapping-deploy lock conflict again. For a free-plan cutover, keep the existing service suspended and create a replacement service using this Dockerfile and the same database, then update the frontend API rewrite and WebSocket URL to the replacement service. This involves downtime and a frontend redeploy. After deployment, log in as an administrator and check System → Metrics Summary, and check the service logs for startup errors. The launcher stops the other process if either the API or Prometheus exits.
