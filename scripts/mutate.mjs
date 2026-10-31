#!/usr/bin/env node
/**
 * Real mutation testing against the 25 mutations in tools/mutations-week11.json.
 *
 * For each mutation this script:
 *   1. Reads the target production file.
 *   2. Applies an exact, anchored string substitution that reproduces the
 *      described bug (verified to match exactly once in the pristine file).
 *   3. Runs the test command that WEEK-11.md names for that mutation's test ID.
 *   4. Records CAUGHT if the test run fails (non-zero exit), SURVIVED if it
 *      still passes.
 *   5. Restores the file to its original byte-for-byte content, regardless
 *      of outcome, before moving to the next mutation.
 *
 * tools/mutations-week11.json is the canonical list of what to mutate and
 * which test should catch it. Several of its `file`/`test` fields point at
 * paths or IDs that no longer match the current tree (the web app was
 * rewritten after that file was written: e.g. web/src/hooks/useSocket.ts is
 * now web/src/ws/useSocket.ts, web/src/lib/money.ts is now
 * web/src/utils/money.ts, web/src/components/forms.ts never existed as a
 * standalone module). RESOLUTIONS below records, for every mutation, the
 * concrete file/anchor/test command actually used, and notes any correction
 * from the JSON's literal fields. Nothing here pre-decides CAUGHT/SURVIVED:
 * that is always the real exit code of the real test command.
 */
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const mutationsCatalogue = JSON.parse(
  readFileSync(path.join(ROOT, "tools/mutations-week11.json"), "utf8")
);

function vitest(testPath, { cwd = "." } = {}) {
  return { cwd, cmd: `npx vitest run "${testPath}" --reporter=dot` };
}

// For tests that need RUN_INTEGRATION=1 and the real Postgres-backed
// integration config (packages/api/src/week11-live.int.test.ts).
function vitestLive(testPath, { cwd = "." } = {}) {
  return {
    cwd,
    cmd: `RUN_INTEGRATION=1 npx vitest run "${testPath}" --config vitest-integration.config.ts --reporter=dot`,
  };
}

// id -> { file, find, replace, test, note? }
// `file` is relative to ROOT. `find` must occur exactly once in the pristine
// file (verified at run time) and is replaced with `replace` to apply the
// mutation, then restored verbatim afterward.
const RESOLUTIONS = {
  1: {
    file: "web/src/state/stream-state.ts",
    find: `      if (existing.epoch !== message.epoch) {
        const syncing: TopicState = { ...existing, status: "syncing" };
        return {
          state: withTopic(state, message.topic, syncing),
          effects: [{ type: "REFETCH_SNAPSHOT", topic: message.topic }],
        };
      }

      if (isBookTopic(message.topic)) {`,
    replace: `      if (isBookTopic(message.topic)) {`,
    test: vitest("src/state/stream.test.ts", { cwd: "web" }),
  },
  2: {
    file: "web/src/state/stream-state.ts",
    find: `    case "snapshot": {
      const next: TopicState = {
        epoch: message.epoch,
        seq: message.seq,
        status: "live",
        conflated: message.conflated === true,
        snapshot: message.data,
      };
      return { state: withTopic(state, message.topic, next), effects: [] };
    }`,
    replace: `    case "snapshot": {
      const priorForMerge = state.topics[message.topic];
      const mergedSnapshot =
        priorForMerge &&
        typeof priorForMerge.snapshot === "object" &&
        priorForMerge.snapshot !== null &&
        typeof message.data === "object" &&
        message.data !== null
          ? { ...(priorForMerge.snapshot), ...(message.data) }
          : message.data;
      const next: TopicState = {
        epoch: message.epoch,
        seq: message.seq,
        status: "live",
        conflated: message.conflated === true,
        snapshot: mergedSnapshot,
      };
      return { state: withTopic(state, message.topic, next), effects: [] };
    }`,
    test: vitest("src/state/stream.test.ts", { cwd: "web" }),
  },
  3: {
    file: "web/src/state/stream-state.ts",
    find: `      if (isBookTopic(message.topic)) {`,
    replace: `      if (false && isBookTopic(message.topic)) {`,
    test: vitest("src/state/stream.test.ts", { cwd: "web" }),
    note: "JSON labels test US4; the actual book-topic-gap assertion is US5, corrected here.",
  },
  4: {
    file: "web/src/state/stream-state.ts",
    find: `      const hasGap = existing.seq !== null && message.seq > existing.seq + 1;
      if (hasGap) {
        const syncing: TopicState = { ...existing, status: "syncing" };
        return {
          state: withTopic(state, message.topic, syncing),
          effects: [{ type: "REFETCH_SNAPSHOT", topic: message.topic }],
        };
      }
      const live: TopicState = { ...existing, seq: message.seq, snapshot: message.data, status: "live" };
      return { state: withTopic(state, message.topic, live), effects: [] };
    }`,
    replace: `      const live: TopicState = { ...existing, seq: message.seq, snapshot: message.data, status: "live" };
      return { state: withTopic(state, message.topic, live), effects: [] };
    }`,
    test: vitest("src/state/stream.test.ts", { cwd: "web" }),
  },
  5: {
    file: "web/src/state/stream-state.ts",
    find: `        if (existing.seq !== null && message.seq <= existing.seq) {
          return { state, effects: [] };
        }
        const live: TopicState = { ...existing, seq: message.seq, snapshot: message.data, status: "live" };
        return { state: withTopic(state, message.topic, live), effects: [] };
      }`,
    replace: `        const live: TopicState = { ...existing, seq: message.seq, snapshot: message.data, status: "live" };
        return { state: withTopic(state, message.topic, live), effects: [] };
      }`,
    test: vitest("src/state/stream.test.ts", { cwd: "web" }),
  },
  6: {
    file: "web/src/ws/useSocket.ts",
    find: `    function connect() {
      socket = createSocket(options.url);`,
    replace: `    function connect() {
      socket = createSocket(\`\${options.url}?token=\${options.token ?? ""}\`);`,
    test: vitest("src/state/stream.test.ts", { cwd: "web" }),
    note: "Real file is web/src/ws/useSocket.ts (JSON says web/src/hooks/useSocket.ts, which does not exist). US1 (in stream.test.ts) exercises useSocket via a fake socket.",
  },
  7: {
    file: "web/src/lib/lifecycle.ts",
    find: `    case "RECEIVED":
      return {
        stage: "journaled",
        spinner: true,
        text: "durably received, not yet accepted",
      };`,
    replace: `    case "RECEIVED":
      return {
        stage: "journaled",
        spinner: true,
        text: "success",
      };`,
    test: vitest("src/lib/lifecycle.test.ts", { cwd: "web" }),
    note: "JSON labels test UL2; UL2 never asserts on RECEIVED's text. UL1 does ('durably received'), corrected here.",
  },
  8: {
    file: "web/src/lib/lifecycle.ts",
    find: `    case "FILLED":
      return {
        stage: "filled",
        spinner: false,
        text: \`\${order.quantity} filled\`,
      };

    case "CANCEL_REQUESTED":
      return {
        stage: "accepted",
        spinner: true,
        text: "cancelling",
        hint: false,
      };`,
    replace: `    case "FILLED":
      return {
        stage: "accepted",
        spinner: true,
        text: "cancelling",
        hint: false,
      };

    case "CANCEL_REQUESTED":
      return {
        stage: "filled",
        spinner: false,
        text: \`\${order.quantity} filled\`,
      };`,
    test: vitest("src/lib/lifecycle.test.ts", { cwd: "web" }),
    note: "deriveLifecycle has no separate 'priority' merge to reverse (it switches on a single already-resolved status), so this swaps the FILLED/CANCEL_REQUESTED case bodies as the closest real reproduction. JSON labels test UL1; UL1 only covers RECEIVED. UL6's property test is what actually checks the FILLED/CANCEL_REQUESTED stage family, corrected here.",
  },
  9: {
    file: "web/src/utils/money.ts",
    find: `  try {
    const qty = BigInt(typeof quantity === "number" ? Math.floor(quantity) : quantity);
    const price = BigInt(priceCap);
    return qty * price;
  } catch {
    return 0n;
  }
}`,
    replace: `  try {
    const qty = Number(quantity);
    const price = Number(priceCap);
    return BigInt(Math.floor(qty * price));
  } catch {
    return 0n;
  }
}`,
    test: vitest("src/utils/money.test.ts", { cwd: "web" }),
    note: "Real file is web/src/utils/money.ts (JSON says web/src/lib/money.ts, which has only a vacuous duplicate test file with no production import).",
  },
  10: {
    file: "web/src/utils/money.ts",
    find: `export function estimateReservation(quantity: string | number, priceCap: string | null): bigint {
  if (!priceCap || priceCap === "null") {
    // MARKET order - no estimate
    return 0n;
  }

  try {
    const qty = BigInt(typeof quantity === "number" ? Math.floor(quantity) : quantity);
    const price = BigInt(priceCap);
    return qty * price;
  } catch {
    return 0n;
  }
}`,
    replace: `export function estimateReservation(quantity: string | number, priceCap: string | null): bigint {
  try {
    const qty = BigInt(typeof quantity === "number" ? Math.floor(quantity) : quantity);
    const price = BigInt(priceCap ?? "1");
    return qty * price;
  } catch {
    return 0n;
  }
}`,
    test: vitest("src/utils/money.test.ts", { cwd: "web" }),
    note: "Removing the MARKET check alone is absorbed by the surrounding try/catch (BigInt(null) throws, still returns 0n), so the null price is also defaulted to '1' to actually surface a nonzero MARKET estimate.",
  },
  11: {
    file: "web/src/components/OrderEntry.tsx",
    find: `      const response = await apiClient.post<OrderResponse>("/orders", {
        clientOrderId,`,
    replace: `      const response = await apiClient.post<OrderResponse>("/orders", {
        clientOrderId: \`\${clientOrderId}-\${Date.now()}-\${Math.random()}\`,`,
    test: vitest("src/components/OrderEntry.test.tsx", { cwd: "web" }),
    note: "Fixed: OrderEntry.tsx previously had its own retry-suffix logic on 409 (contradicting the spec's 'same clientOrderId reused on retry' requirement) and forms.test.ts's UF3 only asserted on an inline closure, never the real component. The 409 retry-suffix behavior was removed (OrderEntry.tsx now shows the spec-required message and does not mutate the id), and real coverage now lives in OrderEntry.test.tsx (UF3).",
  },
  12: {
    file: "web/src/components/OrderEntry.tsx",
    find: `      <button type="submit" disabled={!canSubmit || isSubmitting}>`,
    replace: `      <button type="submit" disabled={!canSubmit}>`,
    test: vitest("src/components/OrderEntry.test.tsx", { cwd: "web" }),
    note: "Fixed: forms.test.ts's UF2 previously asserted on an inline closure it defined itself, not on OrderEntry.tsx. Real coverage (rendering the component, asserting fetch is called exactly once across a double-click) now lives in OrderEntry.test.tsx (UF2).",
  },
  13: {
    file: "packages/common/src/ui-config.ts",
    find: `export function canAccessPage(page: string, userRole: Role | null): boolean {
  const entry = PAGE_ROLES[page];`,
    replace: `export function canAccessPage(page: string, userRole: Role | null): boolean {
  if (page === "/risk") return userRole === "RISK"; // hardcoded, drifted from PAGE_ROLES
  const entry = PAGE_ROLES[page];`,
    test: vitest("src/auth/auth.test.ts", { cwd: "web" }),
    note: "Real implementation is packages/common/src/ui-config.ts (web/src/auth/guards.tsx only calls canAccessPage). Confirmed SURVIVED empirically for a second reason beyond source location: packages/common's package.json exports \"./dist/index.js\", so web's test resolves the package's pre-built dist output, not this live src file -- mutating src alone is invisible to web tests until packages/common is rebuilt.",
  },
  14: {
    file: "web/src/pages/Trading.tsx",
    find: `  const canWrite = useCanWrite("/trade");`,
    replace: `  const canWrite = true;`,
    test: vitest("src/pages/Trading.test.tsx", { cwd: "web" }),
    note: "Fixed: Trading.tsx previously hardcoded its own `user?.role === \"TRADER\"` check instead of calling useCanWrite/canWritePage, so UG3 (which only tested canWritePage directly) could never observe this mutation. Trading.tsx now calls useCanWrite(\"/trade\") for real, and Trading.test.tsx's existing 'ADMIN is read-only' test (not UG3) is what actually catches this.",
  },
  15: {
    file: "packages/telemetry/src/registry.ts",
    find: `export function validateMetricName(name: string): void {
  if (!name.startsWith("ml_")) {
    throw new Error(\`Metric name must start with ml_, got \${name}\`);
  }
}`,
    replace: `export function validateMetricName(name: string): void {
  // validation removed
}`,
    test: vitest("packages/telemetry/src/telemetry.test.ts"),
    note: "No label-name validation (e.g. rejecting an accountId label) exists anywhere in telemetry; validateMetricName only checks the ml_ prefix. Mutated that instead; JSON's test TL2 only inspects the static catalogue table, so TL3 (which calls validateMetricName) is the one that can actually observe this, corrected here.",
  },
  16: {
    file: "packages/telemetry/src/server.ts",
    find: `        } else if (req.url === "/healthz") {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("ok");
        } else {`,
    replace: `        } else if (req.url === "/healthz") {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("ok");
        } else if (req.url === "/status") {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("ok");
        } else {`,
    test: vitest("packages/telemetry/telemetry.test.ts"),
  },
  17: {
    file: "packages/shard/src/shard-host.ts",
    find: `      await this.config.pool.query(
        \`INSERT INTO shard_heartbeats (lease_id, last_heartbeat_at, last_seq, owned_symbols, updated_at)
         VALUES ($1, now(), $2, $3, now())
         ON CONFLICT (lease_id) DO UPDATE SET
         last_heartbeat_at = now(),
         last_seq = $2,
         owned_symbols = $3,
         updated_at = now()\`,
        [leaseId, state.lastSeq, Array.from(state.ownedSymbols)]
      );`,
    replace: `      await this.config.pool.query(
        \`INSERT INTO shard_heartbeats (lease_id, last_heartbeat_at, last_seq, owned_symbols, updated_at)
         VALUES ($1, now(), $2, $3, now())
         ON CONFLICT (lease_id) DO UPDATE SET
         last_heartbeat_at = now(),
         last_seq = $2,
         owned_symbols = $3,
         updated_at = now()
         WHERE shard_heartbeats.last_seq <= $2\`,
        [leaseId, state.lastSeq, Array.from(state.ownedSymbols)]
      );`,
    test: vitest("packages/shard/src/shard-host.test.ts"),
  },
  18: {
    file: "packages/api/src/routes/system.ts",
    find: `const STALE_INTERVALS = 3;`,
    replace: `const STALE_INTERVALS = 2;`,
    test: vitest("packages/api/src/routes/system.test.ts"),
    note: "Real anchor is the STALE_INTERVALS constant (not a literal SQL interval string - the threshold is computed from STALE_INTERVALS * heartbeatMs). Previous anchor ('15 seconds') never existed in this file.",
  },
  19: {
    file: "packages/api/src/system/prom-queries.ts",
    find: `      queryPrometheus(prometheusUrl, 'max(ml_consumer_lag)'),`,
    replace: `      queryPrometheus(prometheusUrl, 'max(arbitrary_user_supplied_metric)'),`,
    test: vitest("packages/api/src/routes/system.test.ts"),
    note: "The actual query construction lives in prom-queries.ts (system.ts only calls fetchMetricsSummary); MS3 checks every outgoing fetch URL against the allowlisted metric substrings.",
  },
  20: {
    file: "packages/api/src/routes/system.ts",
    find: `        return reply.code(200).send({
          available,
          windowSeconds: available ? 60 : null,`,
    replace: `        return reply.code(available ? 200 : 500).send({
          available,
          windowSeconds: available ? 60 : null,`,
    test: vitest("packages/api/src/routes/system.test.ts"),
    note: "fetchMetricsSummary() (prom-queries.ts) already catches its own fetch failures and returns null values without throwing, so the outer catch block system.ts's route handler never fires for MS2's scenario; the real 'Prometheus down -> 200' response is this primary success-path branch, which the mutation now targets.",
  },
  21: {
    file: "packages/api/src/routes/admin.ts",
    find: `  if (deps.isDemo && deps.commandRouter) {`,
    replace: `  if (deps.commandRouter) {`,
    test: vitestLive("packages/api/src/week11-live.int.test.ts"),
    note: "Fixed: packages/simulator/simulator-integration.test.ts's CH3 asserted on an inline closure, not on admin.ts's route registration, and could never catch this. Real coverage is CH3-live in week11-live.int.test.ts, which boots the real app with PROFILE=prod and asserts a real 404 over HTTP for an ADMIN token - this requires RUN_INTEGRATION=1 and a real Postgres.",
  },
  22: {
    file: "packages/simulator/src/flow-model.ts",
    find: `    rng: mulberry32(seed),`,
    replace: `    rng: Math.random,`,
    test: vitest("packages/simulator/src/simulator.test.ts"),
  },
  23: {
    file: "packages/simulator/src/flow-model.ts",
    find: `  const clampTicks = (value: bigint) => value < 1n ? 1n : value > maxPriceTicks ? maxPriceTicks : value;`,
    replace: `  const clampTicks = (value: bigint) => value;`,
    test: vitest("packages/simulator/src/simulator.test.ts"),
    note: "Real anchor is the clampTicks helper (midPriceTicks is now a bigint and clamping was refactored into this closure). Previous anchor (an inline Math.max/Math.min on a number) never existed in this file.",
  },
  24: {
    file: "ops/grafana/provisioning/dashboards/matchledger-main.json",
    find: `"expr": "ml_breaker_state",`,
    replace: `"expr": "ml_nonexistent_metric_xyz",`,
    test: { cwd: ".", cmd: "node scripts/check-dashboard-metrics.mjs" },
    note: "Real dashboard is ops/grafana/provisioning/dashboards/matchledger-main.json (JSON says ops/grafana/dashboards/matchledger.json, which does not exist). The vitest GD1 in scripts/check-dashboard-metrics.ts also points at that nonexistent path and vacuously passes, so scripts/check-dashboard-metrics.mjs (which scans the real provisioning directory against the real catalogue) is used as the real GD1 check instead.",
  },
  25: {
    file: "packages/api/src/routes/admin.ts",
    find: `        try {
          // Stop simulator if running
          if (deps.simulatorState && deps.simulatorState.current) {`,
    replace: `        try {
          await deps.executor.query("DELETE FROM journal", []);
          // Stop simulator if running
          if (deps.simulatorState && deps.simulatorState.current) {`,
    test: vitestLive("packages/api/src/week11-live.int.test.ts"),
    note: "Fixed: packages/simulator/simulator-integration.test.ts's CH5 asserted on inline closures, never on admin.ts's reset route or real journal row counts. Real coverage is CH5-live in week11-live.int.test.ts, which inserts a real journal row, calls the real /admin/demo/reset endpoint twice, and asserts the real row count is unchanged - this requires RUN_INTEGRATION=1 and a real Postgres.",
  },
};

// Safety net: if this process is interrupted (Ctrl-C, timeout kill) while a
// mutation is applied, restore the file before exiting instead of leaving
// mutated production code on disk.
let pendingRestore = null;
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (pendingRestore) {
      writeFileSync(pendingRestore.absPath, pendingRestore.original, "utf8");
      console.error(`\nInterrupted: restored ${pendingRestore.absPath} before exiting.`);
    }
    process.exit(130);
  });
}

function applyMutation(absPath, find, replace) {
  const original = readFileSync(absPath, "utf8");
  const occurrences = original.split(find).length - 1;
  if (occurrences !== 1) {
    return { original, applied: false, occurrences };
  }
  const mutated = original.replace(find, replace);
  writeFileSync(absPath, mutated, "utf8");
  pendingRestore = { absPath, original };
  return { original, applied: true, occurrences };
}

function restoreMutation(absPath, original) {
  writeFileSync(absPath, original, "utf8");
  if (pendingRestore && pendingRestore.absPath === absPath) {
    pendingRestore = null;
  }
}

function runTest(test) {
  try {
    const output = execSync(test.cmd, {
      cwd: path.join(ROOT, test.cwd),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
    return { passed: true, output };
  } catch (err) {
    return { passed: false, output: `${err.stdout ?? ""}\n${err.stderr ?? ""}` };
  }
}

console.log("Mutation Testing Suite (real mutations, real tests)");
console.log(`Loaded ${mutationsCatalogue.length} mutations from tools/mutations-week11.json\n`);

const results = [];
let caught = 0;
let survived = 0;
let errored = 0;

for (const mut of mutationsCatalogue) {
  const resolution = RESOLUTIONS[mut.id];
  process.stdout.write(`M${mut.id} (${mut.test}): ${mut.name}... `);

  if (!resolution) {
    console.log("✗ ERROR (no resolution defined)");
    errored++;
    results.push({ ...mut, status: "ERROR", detail: "no resolution defined" });
    continue;
  }

  const absPath = path.join(ROOT, resolution.file);
  const { original, applied, occurrences } = applyMutation(absPath, resolution.find, resolution.replace);

  if (!applied) {
    console.log(`✗ ERROR (anchor matched ${occurrences} times, expected 1, in ${resolution.file})`);
    errored++;
    results.push({
      ...mut,
      status: "ERROR",
      detail: `anchor matched ${occurrences} times in ${resolution.file}`,
    });
    continue;
  }

  let testResult;
  try {
    testResult = runTest(resolution.test);
  } finally {
    // Restore the file byte-for-byte before doing anything else, success or failure.
    restoreMutation(absPath, original);
  }

  if (testResult.passed) {
    survived++;
    console.log(`✗ SURVIVED (${resolution.test.cmd} still passed)`);
    results.push({
      ...mut,
      status: "SURVIVED",
      resolvedFile: resolution.file,
      testCmd: resolution.test.cmd,
      note: resolution.note,
    });
  } else {
    caught++;
    console.log(`✓ CAUGHT`);
    const failingLines = testResult.output
      .split("\n")
      .filter((l) => /fail|✗|×|FAIL/i.test(l))
      .slice(0, 3)
      .join(" | ");
    results.push({
      ...mut,
      status: "CAUGHT",
      resolvedFile: resolution.file,
      testCmd: resolution.test.cmd,
      evidence: failingLines || "(test command exited non-zero)",
    });
  }
}

console.log("\nSummary");
console.log(`Caught:   ${caught}/${mutationsCatalogue.length}`);
console.log(`Survived: ${survived}/${mutationsCatalogue.length}`);
console.log(`Errored:  ${errored}/${mutationsCatalogue.length}`);

if (survived > 0 || errored > 0) {
  console.log("\nSurvivors (test that should have caught it, and why it didn't):");
  for (const r of results) {
    if (r.status === "SURVIVED" || r.status === "ERROR") {
      console.log(`  M${r.id} [${r.status}] ${r.name} -- intended test: ${r.test}`);
      if (r.note) console.log(`      ${r.note}`);
      if (r.detail) console.log(`      ${r.detail}`);
    }
  }
}

console.log("\nRestoring and verifying the working tree is clean for mutated source files...");
const mutatedFiles = Object.values(RESOLUTIONS).map((r) => r.file);
try {
  const diff = execSync(`git diff --name-only -- ${mutatedFiles.map((f) => `"${f}"`).join(" ")}`, {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  if (diff.length > 0) {
    console.log(`✗ Working tree is NOT clean after restore. Dirty files:\n${diff}`);
    process.exitCode = 1;
  } else {
    console.log("✓ All mutated files restored byte-for-byte (git diff is empty).");
  }
} catch (err) {
  console.log(`(could not verify via git diff: ${err.message})`);
}

console.log(
  JSON.stringify(
    {
      total: mutationsCatalogue.length,
      caught,
      survived,
      errored,
      results: results.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        intendedTest: r.test,
        note: r.note,
        detail: r.detail,
        evidence: r.evidence,
      })),
    },
    null,
    2
  )
);

if (survived === 0 && errored === 0) {
  console.log("\n✅ All mutations caught.");
  process.exitCode = 0;
} else {
  console.log("\n⚠️  Some mutations survived or errored - see table above.");
  process.exitCode = process.exitCode ?? 1;
}
