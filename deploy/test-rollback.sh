#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="$(mktemp -d)"
PROJECT_NAME="matchledger-dp9-$$"
PREVIOUS_TAG="dp9-previous-$$"
NODE_BIN="$(command -v node)"

cleanup() {
  docker compose -p "$PROJECT_NAME" --env-file "$TEMP_DIR/deploy.env" -f "$TEMP_DIR/compose.yml" down -v --remove-orphans >/dev/null 2>&1 || true
  docker image rm "matchledger-api:$PREVIOUS_TAG" >/dev/null 2>&1 || true
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

if ! docker image inspect node:22 >/dev/null 2>&1; then
  printf 'DP9 requires the locally available Node image node:22.\n' >&2
  exit 2
fi

docker tag node:22 "matchledger-api:$PREVIOUS_TAG"
cat > "$TEMP_DIR/Dockerfile.broken" <<'EOF'
FROM node:24-alpine
COPY deliberately-missing-file /app/must-fail
EOF
cat > "$TEMP_DIR/compose.yml" <<'EOF'
services:
  api:
    image: matchledger-api:${APP_IMAGE_TAG}
    build:
      context: .
      dockerfile: Dockerfile.broken
    command: [node, -e, "setInterval(()=>{}, 1000)"]
    healthcheck:
      test: [CMD, node, -e, "process.exit(require('fs').existsSync('/tmp/fail-health')?1:0)"]
      interval: 2s
      timeout: 1s
      retries: 2
    restart: unless-stopped
EOF
cat > "$TEMP_DIR/deploy.env" <<'EOF'
PUBLIC_ORIGIN=localhost
EOF
cat > "$TEMP_DIR/bin-node" <<EOF
#!/usr/bin/env bash
if [[ "\${1:-}" == "scripts/smoke.mjs" ]]; then
  [[ "\${APP_IMAGE_TAG:-}" == "$PREVIOUS_TAG" ]]
  exit
fi
exec "$NODE_BIN" "\$@"
EOF
mkdir -p "$TEMP_DIR/bin"
mv "$TEMP_DIR/bin-node" "$TEMP_DIR/bin/node"
chmod +x "$TEMP_DIR/bin/node"

APP_IMAGE_TAG="$PREVIOUS_TAG" \
COMPOSE_PROJECT_NAME="$PROJECT_NAME" \
docker compose -p "$PROJECT_NAME" --env-file "$TEMP_DIR/deploy.env" \
  -f "$TEMP_DIR/compose.yml" up -d --wait --no-build

PREVIOUS_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "matchledger-api:$PREVIOUS_TAG")"

set +e
PATH="$TEMP_DIR/bin:$PATH" \
DEPLOY_ENV_FILE="$TEMP_DIR/deploy.env" \
APP_IMAGE_TAG="$PREVIOUS_TAG" \
COMPOSE_FILE="$TEMP_DIR/compose.yml" \
COMPOSE_PROJECT_NAME="$PROJECT_NAME" \
SMOKE_URL=https://localhost \
bash "$ROOT_DIR/deploy/deploy.sh" >"$TEMP_DIR/output.log" 2>&1
status=$?
set -e

if [[ $status -eq 0 ]]; then
  cat "$TEMP_DIR/output.log" >&2
  printf 'DP9 failed: deploy script accepted the deliberately broken Docker build.\n' >&2
  exit 1
fi
if ! grep -q "Rollback restored image tag $PREVIOUS_TAG and smoke passed." "$TEMP_DIR/output.log"; then
  cat "$TEMP_DIR/output.log" >&2
  printf 'DP9 failed: previous image tag was not restored and smoke-checked.\n' >&2
  exit 1
fi
printf 'DP9 passed: the broken Docker build failed and restored tag %s.\n' "$PREVIOUS_TAG"

cat > "$TEMP_DIR/Dockerfile.broken" <<'EOF'
FROM node:22
RUN touch /tmp/fail-health
EOF
set +e
PATH="$TEMP_DIR/bin:$PATH" \
DEPLOY_ENV_FILE="$TEMP_DIR/deploy.env" \
APP_IMAGE_TAG="$PREVIOUS_TAG" \
COMPOSE_FILE="$TEMP_DIR/compose.yml" \
COMPOSE_PROJECT_NAME="$PROJECT_NAME" \
SMOKE_URL=https://localhost \
bash "$ROOT_DIR/deploy/deploy.sh" >"$TEMP_DIR/output-same-tag.log" 2>&1
status=$?
set -e

if [[ $status -eq 0 ]]; then
  cat "$TEMP_DIR/output-same-tag.log" >&2
  printf 'DP9 same-tag rollback failed: unhealthy release was accepted.\n' >&2
  exit 1
fi
if ! grep -q "Rollback restored image tag $PREVIOUS_TAG and smoke passed." "$TEMP_DIR/output-same-tag.log"; then
  cat "$TEMP_DIR/output-same-tag.log" >&2
  printf 'DP9 same-tag rollback failed: prior tag was not restored.\n' >&2
  exit 1
fi
CURRENT_CONTAINER="$(APP_IMAGE_TAG="$PREVIOUS_TAG" docker compose -p "$PROJECT_NAME" --env-file "$TEMP_DIR/deploy.env" -f "$TEMP_DIR/compose.yml" ps -q api)"
RESTORED_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$CURRENT_CONTAINER")"
if [[ "$RESTORED_IMAGE_ID" != "$PREVIOUS_IMAGE_ID" ]]; then
  printf 'DP9 same-tag rollback restored %s; expected %s.\n' "$RESTORED_IMAGE_ID" "$PREVIOUS_IMAGE_ID" >&2
  exit 1
fi
printf 'DP9 same-tag rollback passed: original image ID restored after a built release became unhealthy.\n'
