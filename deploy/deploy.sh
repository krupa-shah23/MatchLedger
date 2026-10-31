#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${DEPLOY_ENV_FILE:-deploy/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Deployment environment file not found: %s\n' "$ENV_FILE" >&2
  exit 2
fi
if [[ "$ENV_FILE" != /* ]]; then
  ENV_FILE="$ROOT_DIR/$ENV_FILE"
fi
export DEPLOY_ENV_FILE="$ENV_FILE"

env_value() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | head -n 1
}

PUBLIC_ORIGIN_VALUE="${PUBLIC_ORIGIN:-$(env_value PUBLIC_ORIGIN)}"
if [[ -z "$PUBLIC_ORIGIN_VALUE" ]]; then
  printf 'PUBLIC_ORIGIN must be set in %s\n' "$ENV_FILE" >&2
  exit 2
fi

TAG_VALUE="${APP_IMAGE_TAG:-$(env_value APP_IMAGE_TAG)}"
if [[ -z "$TAG_VALUE" ]]; then
  TAG_VALUE="$(git rev-parse --short HEAD)"
fi
export APP_IMAGE_TAG="$TAG_VALUE"

compose() {
  if [[ -n "${COMPOSE_FILE:-}" ]]; then
    docker compose --env-file "$ENV_FILE" "$@"
  else
    docker compose --env-file "$ENV_FILE" -f docker-compose.yml -f deploy/docker-compose.prod.yml "$@"
  fi
}

previous_container="$(compose ps -q api 2>/dev/null || true)"
previous_tag=""
previous_image_id=""
rollback_image_tag=""
if [[ -n "$previous_container" ]]; then
  previous_image="$(docker inspect --format '{{.Config.Image}}' "$previous_container")"
  previous_tag="${previous_image##*:}"
  previous_image_id="$(docker inspect --format '{{.Image}}' "$previous_container")"
  rollback_image_tag="rollback-${BASHPID}"
  docker tag "$previous_image_id" "matchledger-api:$rollback_image_tag"
fi
printf 'Previous API image tag: %s\n' "${previous_tag:-none}"
printf 'Building deployment image tag: %s\n' "$APP_IMAGE_TAG"

rollback() {
  local cause="$1"
  printf 'Deployment failed during %s; restoring the previous image tag.\n' "$cause" >&2
  if [[ -z "$previous_tag" ]]; then
    printf 'Rollback unavailable: no previous API container was running.\n' >&2
    return 1
  fi

  if ! docker tag "matchledger-api:$rollback_image_tag" "matchledger-api:$previous_tag"; then
    printf 'Rollback image could not be restored from tag %s.\n' "$rollback_image_tag" >&2
    return 1
  fi
  export APP_IMAGE_TAG="$previous_tag"
  if ! compose up -d --wait --no-build --force-recreate; then
    printf 'Rollback Compose start failed for tag %s.\n' "$previous_tag" >&2
    return 1
  fi
  if ! SMOKE_URL="${SMOKE_URL:-https://${PUBLIC_ORIGIN_VALUE}}" node scripts/smoke.mjs; then
    printf 'Rollback smoke failed for tag %s.\n' "$previous_tag" >&2
    return 1
  fi
  docker image rm "matchledger-api:$rollback_image_tag" >/dev/null
  rollback_image_tag=""
  printf 'Rollback restored image tag %s and smoke passed.\n' "$previous_tag"
}

if ! compose config -q; then
  rollback "Compose validation" || true
  exit 1
fi
if ! compose build; then
  rollback "build" || true
  exit 1
fi
if ! compose up -d --wait --wait-timeout 180 --force-recreate; then
  rollback "Compose startup" || true
  exit 1
fi
if ! SMOKE_URL="${SMOKE_URL:-https://${PUBLIC_ORIGIN_VALUE}}" node scripts/smoke.mjs; then
  rollback "smoke" || true
  exit 1
fi

if [[ -n "$rollback_image_tag" ]]; then
  docker image rm "matchledger-api:$rollback_image_tag" >/dev/null
fi
printf 'Deployment succeeded with image tag %s.\n' "$APP_IMAGE_TAG"
