/**
 * NP1: No placeholder tests in web, and the checker that enforces it has teeth.
 *
 * Two parts:
 * 1. Positive proof: web/src currently has zero it.todo/it.skip/test.skip/
 *    describe.skip/xit/xdescribe/.only — scanned directly, not just trusted.
 * 2. Negative proof: scripts/check-no-placeholders.mjs actually flags a
 *    seeded it.todo if one is introduced (and the seeded file is always
 *    removed afterward, success or failure).
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(process.cwd());

describe("NP1: No placeholder tests in web", () => {
  it("NP1: web/src has no it.todo, it.skip, test.skip, describe.skip, xit, xdescribe, or .only", () => {
    const skipPattern = /\bit\.todo(?:\(|\b)|\bit\.skip(?:\(|\b)|\btest\.todo(?:\(|\b)|\btest\.skip(?:\(|\b)|\bdescribe\.skip(?:\(|\b)|\bxit\(|\bxdescribe\(|\b(?:it|test|describe)\.only\s*\(/;

    const violations: Array<{ file: string; line: number }> = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "dist-test") continue;
          walk(full);
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          const lines = fs.readFileSync(full, "utf8").split("\n");
          lines.forEach((line, idx) => {
            if (skipPattern.test(line)) violations.push({ file: full, line: idx + 1 });
          });
        }
      }
    };
    walk(path.join(ROOT, "web", "src"));

    expect(violations).toEqual([]);
  });

  it("NP1: check-no-placeholders.mjs catches a seeded it.todo in web/src (negative proof)", () => {
    const seedFile = path.join(ROOT, "web", "src", "__np1-seeded-violation.test.ts");
    fs.writeFileSync(
      seedFile,
      `import { describe, it } from "vitest";\ndescribe("seeded", () => { it.todo("NP1 negative-proof seed, should be caught"); });\n`
    );

    try {
      let threw = false;
      let output = "";
      try {
        execFileSync(process.execPath, [path.join(ROOT, "scripts", "check-no-placeholders.mjs")], {
          cwd: ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (err) {
        threw = true;
        const e = err as { stderr?: string; stdout?: string };
        output = (e.stdout ?? "") + (e.stderr ?? "");
      }

      expect(threw).toBe(true);
      expect(output).toContain("it.todo");
      expect(output).toContain("__np1-seeded-violation.test.ts");
    } finally {
      fs.unlinkSync(seedFile);
    }
  });
});
