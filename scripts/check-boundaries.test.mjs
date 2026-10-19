/**
 * Test that check-boundaries.mjs correctly detects and fails on seeded violations.
 * This test creates a temporary package.json with a forbidden dependency,
 * verifies the checker detects it, and then removes the violation.
 *
 * Run: node scripts/check-boundaries.test.mjs
 */

import { writeFile, unlink, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const testPackagePath = "packages/transport/package.json";
let originalContent;

async function runChecker() {
  return new Promise((resolve) => {
    const proc = spawn("node", ["scripts/check-boundaries.mjs"], {
      stdio: "pipe",
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function test() {
  console.log("Testing boundary checker...\n");

  // Step 1: Save original content
  console.log("1. Reading original package.json...");
  originalContent = JSON.parse(await readFile(testPackagePath, "utf8"));
  console.log("   ✓ Original saved\n");

  // Step 2: Test that the checker passes with correct dependencies
  console.log("2. Running checker with valid dependencies...");
  let result = await runChecker();
  if (result.code !== 0) {
    console.error("   ✗ FAILED: Checker failed on valid config");
    console.error(result.stderr);
    process.exit(1);
  }
  console.log("   ✓ Checker passed\n");

  // Step 3: Inject a forbidden dependency (api)
  console.log("3. Seeding violation: adding forbidden @matchledger/api dependency...");
  const violatedContent = JSON.parse(JSON.stringify(originalContent));
  violatedContent.dependencies["@matchledger/api"] = "file:../api";
  await writeFile(testPackagePath, JSON.stringify(violatedContent, null, 2));
  console.log("   ✓ Violation seeded\n");

  // Step 4: Run checker and verify it fails
  console.log("4. Running checker with seeded violation...");
  result = await runChecker();
  if (result.code === 0) {
    console.error("   ✗ FAILED: Checker did not detect violation!");
    console.error("   Expected failure but checker passed");
    await writeFile(testPackagePath, JSON.stringify(originalContent, null, 2));
    process.exit(1);
  }
  if (!result.stderr.includes("@matchledger/api")) {
    console.error("   ✗ FAILED: Violation not properly reported");
    console.error(result.stderr);
    await writeFile(testPackagePath, JSON.stringify(originalContent, null, 2));
    process.exit(1);
  }
  console.log("   ✓ Checker correctly detected violation");
  console.log(`   Error message: "${result.stderr.split("\n")[0]}"\n`);

  // Step 5: Restore original and verify checker passes again
  console.log("5. Removing violation and re-running checker...");
  await writeFile(testPackagePath, JSON.stringify(originalContent, null, 2));
  result = await runChecker();
  if (result.code !== 0) {
    console.error("   ✗ FAILED: Checker failed after removing violation");
    console.error(result.stderr);
    process.exit(1);
  }
  console.log("   ✓ Checker passed after cleanup\n");

  // Step 6: Test another violation (web package)
  console.log("6. Seeding second violation: adding Kafka client to transport...");
  const violated2 = JSON.parse(JSON.stringify(originalContent));
  violated2.dependencies["pg"] = "^8.0.0";
  await writeFile(testPackagePath, JSON.stringify(violated2, null, 2));
  console.log("   ✓ Violation seeded\n");

  console.log("7. Running checker with pg dependency violation...");
  result = await runChecker();
  if (result.code === 0) {
    console.error("   ✗ FAILED: Checker did not detect pg violation!");
    await writeFile(testPackagePath, JSON.stringify(originalContent, null, 2));
    process.exit(1);
  }
  if (!result.stderr.includes("pg")) {
    console.error("   ✗ FAILED: pg violation not properly reported");
    console.error(result.stderr);
    await writeFile(testPackagePath, JSON.stringify(originalContent, null, 2));
    process.exit(1);
  }
  console.log("   ✓ Checker correctly detected pg violation\n");

  // Final cleanup
  console.log("8. Final cleanup...");
  await writeFile(testPackagePath, JSON.stringify(originalContent, null, 2));
  console.log("   ✓ Restored original\n");

  console.log("✅ All boundary checker tests passed!");
}

test().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
