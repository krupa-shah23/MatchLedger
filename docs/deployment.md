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
- `PROFILE=demo`: seeds demo accounts and enables the simulator.
- `TRANSPORT=inproc`: runs the matching component in this API process. Kafka mode requires separately running Kafka and shard services.
- `METRICS_HOST=127.0.0.1`: keeps metrics private to the service.

Keep Render's provided `PORT`; the API listens on `0.0.0.0`. Set Render's Health Check Path to `/healthz`. It is available after recovery and projection catch-up, returns ready only when a database query succeeds, and exposes no account data. `/system/health` requires authentication and is unsuitable as Render's unauthenticated health check.

The API now logs startup phases: database connection, exclusive runtime ownership, migrations, journal recovery, demo account seed, projection catch-up, routes, and listeners. `DB_CONNECT_TIMEOUT_MS` limits pool acquisition/connection waits; `DB_STATEMENT_TIMEOUT_MS` limits database statement execution; `API_STARTUP_TIMEOUT_MS` bounds CLI startup as a whole. Each is a validated positive integer with a default in `packages/api/src/startup-config.ts`. A timeout exits with an error instead of leaving the deployment indefinitely starting. Large journal recoveries may need a larger startup deadline.

Run exactly one API against each database. The advisory lock deliberately refuses a second owner; a rolling deployment overlapping the old API can therefore fail. Stop the old service before starting its replacement if logs report another owner. Do not bypass that lock or erase the journal to deploy.

After deployment, request `/healthz` on the actual Render service URL and confirm JSON with `status: ready`, then verify demo login and WebSocket authentication. Vercel's `/api/v1` rewrite and `VITE_WS_URL` must use that same verified service hostname. Local checks cannot certify a remote database URL or Render service state.
