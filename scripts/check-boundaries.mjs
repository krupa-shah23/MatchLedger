import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const allowed = new Map([
  ["engine-core", []],
  ["common", ["@matchledger/engine-core", "zod"]],
  ["journal", ["@matchledger/engine-core", "@matchledger/common", "pg"]],
  ["shard", ["@matchledger/engine-core", "@matchledger/common", "@matchledger/journal", "@confluentinc/kafka-javascript"]],
  ["risk", ["@matchledger/common"]],
  ["ledger", ["@matchledger/common"]],
  ["recon", ["@matchledger/common", "@matchledger/journal"]],
  ["projections", ["@matchledger/common", "pg", "redis", "@confluentinc/kafka-javascript"]],
  ["api", ["@matchledger/common", "@matchledger/journal", "@matchledger/projections", "@matchledger/risk", "@matchledger/recon", "fastify", "@fastify/websocket", "jose", "prom-client", "ws"]],
  ["simulator", ["@matchledger/common", "@confluentinc/kafka-javascript"]],
  ["benchmarks", ["@matchledger/engine-core", "@matchledger/common", "@matchledger/shard", "@matchledger/risk", "tinybench"]],
  ["system-tests", ["@matchledger/engine-core", "@matchledger/common", "@matchledger/shard", "@matchledger/risk", "@matchledger/ledger", "@matchledger/journal"]],
  ["web", ["@matchledger/common"]],
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

if (errors.length > 0) {
  console.error(`Dependency boundary check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}

console.log("Dependency boundaries verified for all workspaces.");
