#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { execSync } from "child_process";
import { mkdtempSync, cpSync, rmSync } from "fs";
import { tmpdir } from "os";

const mutations = JSON.parse(fs.readFileSync("tools/mutations.json", "utf8"));
const results = [];

function checkGitStatus() {
  try {
    const status = execSync("git status --porcelain").toString();
    return status.trim();
  } catch {
    return "";
  }
}

async function runTests(testFiles, schema) {
  return new Promise((resolve) => {
    const args = ["run", "--reporter=json", "--reporter=default"];
    testFiles.forEach((f) => args.push(f));

    const proc = spawn("npm", args, {
      env: { ...process.env, RUN_INTEGRATION: "1", TEST_SCHEMA: schema },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("exit", (code) => {
      try {
        const json = JSON.parse(output);
        const failed = json.testResults?.flatMap((r) => r.assertionResults?.filter((a) => !a.status.includes("pass"))?.map((a) => a.fullName)) || [];
        resolve({ code, failed, output });
      } catch {
        resolve({ code, failed: [], output });
      }
    });
  });
}

async function applyMutation(file, find, replace) {
  const content = fs.readFileSync(file, "utf8");
  const count = (content.match(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;

  if (count !== 1) {
    throw new Error(`find string occurs ${count} times, expected 1`);
  }

  const replaced = content.replace(find, replace);
  fs.writeFileSync(file, replaced, "utf8");
}

async function revertMutation(file, find, replace) {
  const content = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, content.replace(replace, find), "utf8");
}

async function runMutation(mutation, index) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "mutate-"));

  try {
    // Copy repo
    cpSync(".", tempDir, { recursive: true, filter: (src) => !src.includes(".git") && !src.includes("node_modules") });

    // Link node_modules
    if (fs.existsSync("node_modules")) {
      const link = path.join(tempDir, "node_modules");
      try {
        fs.symlinkSync(path.resolve("node_modules"), link);
      } catch {
        fs.junctionSync(path.resolve("node_modules"), link);
      }
    }

    // Apply mutation in temp copy
    const filePath = path.join(tempDir, mutation.file);
    applyMutation(filePath, mutation.find, mutation.replace);

    // Run tests
    const result = await runTests(mutation.tests, `test_${mutation.id}`);

    const caught = result.code !== 0;
    const failedTests = (result.failed || []).filter((t) => mutation.expectFail.some((e) => t.includes(e)));

    results.push({
      id: mutation.id,
      description: mutation.description,
      caught: caught ? "YES" : "NO",
      failedTests: failedTests.length,
      expectedTests: mutation.expectFail.length,
      surprise: caught && failedTests.length === 0 ? "EXTRA" : caught === false && failedTests.length === 0 ? "NONE" : "OK",
    });

    console.log(`[${index}/${mutations.length}] ${mutation.id}: ${caught ? "CAUGHT" : "SURVIVED"}`);
  } catch (err) {
    console.error(`[${index}/${mutations.length}] ${mutation.id}: ERROR -`, err.message);
    results.push({
      id: mutation.id,
      description: mutation.description,
      caught: "ERROR",
      failedTests: 0,
      expectedTests: mutation.expectFail.length,
      surprise: "INVALID",
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const before = checkGitStatus();

  for (let i = 0; i < mutations.length; i++) {
    await runMutation(mutations[i], i + 1);
  }

  const after = checkGitStatus();

  if (before !== after) {
    console.error("ERROR: Git status changed!");
    process.exit(1);
  }

  console.table(results);
  const survived = results.filter((r) => r.caught === "NO").length;
  console.log(`\nSurvived: ${survived}/${results.length}`);

  if (survived > 0) {
    console.error("FAIL: Some mutations survived");
    process.exit(1);
  }
}

main().catch(console.error);
