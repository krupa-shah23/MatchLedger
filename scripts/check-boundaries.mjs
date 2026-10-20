import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const allowed = new Map([
  ["engine-core", []],
  ["common", ["@matchledger/engine-core", "zod"]],
  ["journal", ["@matchledger/engine-core", "@matchledger/common", "pg"]],
  ["telemetry", ["@matchledger/common", "prom-client"]],
  ["transport", ["@matchledger/common", "@matchledger/journal", "@confluentinc/kafka-javascript"]],
  ["shard", ["@matchledger/engine-core", "@matchledger/common", "@matchledger/journal", "@matchledger/transport", "@matchledger/telemetry", "@confluentinc/kafka-javascript", "zod"]],
  ["risk", ["@matchledger/common"]],
  ["ledger", ["@matchledger/common"]],
  ["recon", ["@matchledger/common", "@matchledger/journal"]],
  ["projections", ["@matchledger/common", "pg", "redis", "@confluentinc/kafka-javascript"]],
  ["api", ["@matchledger/common", "@matchledger/journal", "@matchledger/projections", "@matchledger/risk", "@matchledger/recon", "fastify", "@fastify/multipart", "@fastify/websocket", "jose", "prom-client", "ws"]],
  ["runtime", ["@matchledger/engine-core", "@matchledger/common", "@matchledger/journal", "@matchledger/transport", "@matchledger/shard", "@matchledger/risk", "@matchledger/recon", "@matchledger/ledger", "@confluentinc/kafka-javascript"]],
  ["simulator", ["@matchledger/common", "@confluentinc/kafka-javascript"]],
  ["benchmarks", ["@matchledger/engine-core", "@matchledger/common", "@matchledger/shard", "@matchledger/risk", "tinybench"]],
  ["system-tests", ["@matchledger/engine-core", "@matchledger/common", "@matchledger/shard", "@matchledger/risk", "@matchledger/ledger", "@matchledger/journal", "@matchledger/recon"]],
  ["web", ["@matchledger/common", "react", "react-dom", "react-router-dom", "@tanstack/react-query"]],
]);

const errors = [];

for (const [dir, names] of allowed) {
  const path = dir === "web" ? "web/package.json" : `packages/${dir}/package.json`;
  const packageJson = JSON.parse(await readFile(path, "utf8"));
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const name of Object.keys(packageJson[field] ?? {})) {
      if (field !== "devDependencies" && !names.includes(name)) {
        errors.push(`${path}: ${field}.${name} is forbidden (allowed: ${names.join(", ") || "none"})`);
      }
    }
  }
  if (dir === "engine-core" && JSON.stringify(packageJson.dependencies ?? {}) !== "{}") {
    errors.push(`${path}: engine-core dependencies must be exactly {}`);
  }
}

async function findTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findTypeScriptFiles(path));
    else if (entry.isFile() && path.endsWith(".ts")) files.push(path);
  }
  return files;
}

for (const path of await findTypeScriptFiles("packages/common/src")) {
  const source = await readFile(path, "utf8");
  if (/\bfrom\s+["']node:|import\s+["']node:/.test(source)) {
    errors.push(`${path}: node:* imports are forbidden in browser-safe common source`);
  }
  for (const timer of ["setTimeout", "setInterval", "setImmediate", "queueMicrotask"]) {
    if (new RegExp(`\\b${timer}\\b`).test(source)) {
      errors.push(`${path}: ${timer} is forbidden in browser-safe common source`);
    }
  }
}

for (const path of await findTypeScriptFiles("packages/recon/src/core")) {
  if (path.endsWith(".test.ts") || path.endsWith(".spec.ts")) {
    continue;
  }
  const source = await readFile(path, "utf8");
  if (/\bfrom\s+["']node:|import\s+["']node:/.test(source) || /\bfrom\s+["']@matchledger\/[A-Za-z0-9_-]+["']/.test(source) && !/\bfrom\s+["']@matchledger\/common["']/.test(source)) {
    errors.push(`${path}: recon core may only import type from @matchledger/common and no node:* imports`);
  }
  for (const banned of ["Date", "Math.random", "setTimeout", "setInterval", "setImmediate", "queueMicrotask", "process", "crypto", "fetch"]) {
    if (new RegExp(`\\b${banned}\\b`).test(source)) {
      errors.push(`${path}: ${banned} is forbidden in recon core`);
    }
  }
  if (/\bawait\b|\bPromise\b|\bnew\s+Promise\b/.test(source)) {
    errors.push(`${path}: recon core must remain synchronous and promise-free`);
  }
}

if (errors.length > 0) {
  console.error(`Dependency boundary check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}

console.log("Dependency boundaries verified for all workspaces.");
