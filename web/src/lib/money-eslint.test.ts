/**
 * UZ5: ESLint rule test - Number() and parseFloat() on money identifiers fail lint
 * This is a negative proof: the rule should catch violations
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

describe("UZ5: Money ESLint Rule", () => {
  it("UZ5: ESLint rule rejects Number() and parseFloat() on money-named identifiers", () => {
    // Create a temporary test file with a violation
    const testDir = path.join(process.cwd(), "web/src/.test-eslint");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const testFile = path.join(testDir, "violation.ts");
    const violationCode = `
      // This should fail ESLint
      const moneyString = "150.50";
      const amount = Number(moneyString); // VIOLATION: Number() on money
      const price = parseFloat(moneyString); // VIOLATION: parseFloat() on money
    `;

    fs.writeFileSync(testFile, violationCode);

    try {
      // Try to lint the file - should fail
      execSync(`npx eslint ${testFile}`, { stdio: "pipe" });
      // If we get here, the rule didn't catch it
      expect.fail("ESLint rule should have caught Number() on money");
    } catch (error) {
      // Expected: ESLint should fail
      const err = error as { status?: number; stdout?: Buffer; stderr?: Buffer };
      expect(err.status).toBeGreaterThan(0);
      const output = err.stdout?.toString() || err.stderr?.toString() || "";
      expect(output.toLowerCase()).toMatch(/number|parsefloat/i);
    } finally {
      // Cleanup
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  });
});
