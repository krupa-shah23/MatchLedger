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
