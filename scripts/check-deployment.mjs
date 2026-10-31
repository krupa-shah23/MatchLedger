#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const exampleEnv = resolve(root, "deploy/.env.example");
const env = {
  ...process.env,
  DEPLOY_ENV_FILE: exampleEnv,
  POSTGRES_PASSWORD: "dp1-validation-only",
  JWT_SECRET: "dp1-validation-only-secret-value-32-bytes",
  GRAFANA_ADMIN_PASSWORD: "dp1-validation-only",
};
const composeText = execFileSync("docker", [
  "compose", "--env-file", exampleEnv,
  "-f", "docker-compose.yml", "-f", "deploy/docker-compose.prod.yml",
  "config", "--format", "json",
], { cwd: root, env, encoding: "utf8" });
const compose = JSON.parse(composeText);
const errors = [];
const services = compose.services;
const persistentServices = Object.keys(services).filter((name) => name !== "topic-init");

for (const [name, service] of Object.entries(services)) {
  const image = service.image;
  if (!image) errors.push(`${name}: image reference is missing`);
  else if (/:latest(?:@|$)/i.test(image)) errors.push(`${name}: latest image tag is forbidden`);
}

for (const name of persistentServices) {
  const service = services[name];
  if (service.restart !== "unless-stopped") errors.push(`${name}: restart policy is not unless-stopped`);
  if (!service.healthcheck) errors.push(`${name}: missing healthcheck`);
  if (service.logging?.driver !== "json-file" || !service.logging.options?.["max-size"] || !service.logging.options?.["max-file"]) {
    errors.push(`${name}: missing json-file log rotation`);
  }
  if (!service.deploy?.resources?.limits?.cpus || !service.deploy?.resources?.limits?.memory) {
    errors.push(`${name}: missing CPU or memory limit`);
  }
}

const topicInit = services["topic-init"];
if (!topicInit || topicInit.restart !== "no") errors.push("topic-init must be a non-restarting one-shot service");
if (topicInit?.depends_on?.kafka?.condition !== "service_healthy") errors.push("topic-init must wait for healthy Kafka");
for (const name of ["api", "shard-0", "shard-1"]) {
  const dependencies = services[name]?.depends_on ?? {};
  if (dependencies.postgres?.condition !== "service_healthy" || dependencies.kafka?.condition !== "service_healthy") {
    errors.push(`${name}: must wait for healthy Postgres and Kafka`);
  }
  if (dependencies["topic-init"]?.condition !== "service_completed_successfully") {
    errors.push(`${name}: must wait for successful topic creation`);
  }
}

const published = Object.entries(services).flatMap(([name, service]) =>
  (service.ports ?? []).map((port) => ({ name, target: Number(port.target), published: Number(port.published) })));
if (published.some((port) => port.name !== "proxy" || ![80, 443].includes(port.target))) {
  errors.push("only the proxy may publish ports 80 or 443");
}
if (!published.some((port) => port.name === "proxy" && port.target === 80)
    || !published.some((port) => port.name === "proxy" && port.target === 443)) {
  errors.push("proxy must publish ports 80 and 443");
}

for (const name of ["postgres", "kafka", "prometheus", "grafana"]) {
  if (!(services[name]?.volumes ?? []).some((volume) => volume.type === "volume")) {
    errors.push(`${name}: missing named data volume`);
  }
}
if (!compose.volumes?.["prometheus-data"] || !compose.volumes?.["grafana-data"]) errors.push("Prometheus/Grafana named volumes are undeclared");
if (!services.prometheus.command?.some((arg) => arg.startsWith("--storage.tsdb.retention.time="))
    || !services.prometheus.command?.some((arg) => arg.startsWith("--storage.tsdb.retention.size="))) {
  errors.push("Prometheus retention time and size must both be bounded");
}
if (!services.kafka.environment?.KAFKA_HEAP_OPTS?.includes("-Xmx")) errors.push("Kafka heap maximum is not explicit");
if (!services.api.command?.some((arg) => arg.startsWith("--max-old-space-size="))) errors.push("API Node heap maximum is not explicit");
for (const name of ["shard-0", "shard-1"]) {
  if (!services[name].environment?.NODE_OPTIONS?.includes("--max-old-space-size=")) errors.push(`${name}: Node heap maximum is not explicit`);
}

const proxy = readFileSync(resolve(root, "deploy/Caddyfile"), "utf8");
const proxyImage = readFileSync(resolve(root, "deploy/Dockerfile.proxy"), "utf8");
const uploadSource = readFileSync(resolve(root, "packages/api/src/routes/recon.ts"), "utf8");
const uploadLimit = uploadSource.match(/RECON_UPLOAD_LIMIT_BYTES\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)/);
const bodyLimit = proxy.match(/max_size\s+(\d+)MB/);
if (!proxy.includes("{$PUBLIC_ORIGIN}")) errors.push("Caddyfile must derive the site host and CSP host from PUBLIC_ORIGIN");
if (!proxy.includes("reverse_proxy api:3000") || !proxy.includes("uri strip_prefix /api/v1")) errors.push("API proxy path is missing or is not stripped to the OpenAPI route");
if (!proxy.includes("@websocket path /ws") || !proxy.includes("reverse_proxy api:3000")) errors.push("WebSocket reverse proxy is missing");
if (!proxy.includes("stream_timeout 24h")) errors.push("WebSocket stream timeout must exceed the gateway ping interval");
for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
  if (!proxy.includes(header)) errors.push(`missing security header: ${header}`);
}
if (proxy.includes("unsafe-inline") || proxy.includes("unsafe-eval")) errors.push("CSP includes an unsafe script/style source");
if (!proxy.includes("encode zstd gzip") || !proxy.includes("/assets/*") || !proxy.includes("/index.html")) {
  errors.push("static compression and asset/index caching rules are incomplete");
}
if (!uploadLimit || !bodyLimit) errors.push("could not compare proxy and API upload limits");
else {
  const apiBytes = Number(uploadLimit[1]) * Number(uploadLimit[2]) * Number(uploadLimit[3]) + 1024 * 1024;
  const proxyBytes = Number(bodyLimit[1]) * 1_000_000;
  if (proxyBytes < apiBytes) errors.push("proxy request body limit is below the Fastify multipart body limit");
}
if (!proxyImage.includes("COPY --from=web-build /app/web/dist /srv")) errors.push("proxy image does not contain the production web build");

const caddyImage = proxyImage.match(/^FROM\s+(caddy:[^\s]+)(?:\s+AS\s+\S+)?/im)?.[1];
if (!caddyImage) errors.push("Caddy image is not pinned in Dockerfile.proxy");
else execFileSync("docker", ["run", "--rm", "-e", "PUBLIC_ORIGIN=localhost", "-v", `${root}/deploy/Caddyfile:/etc/caddy/Caddyfile:ro`, caddyImage, "caddy", "validate", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"], { cwd: root, stdio: "pipe" });

if (errors.length) {
  for (const error of errors) process.stderr.write(`FAIL ${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("DP1/DP2 passed: merged Compose policy and pinned Caddyfile validated.\n");
}
