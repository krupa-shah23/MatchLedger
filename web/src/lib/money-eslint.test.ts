/**
 * UZ5: ESLint rule test - Number() and parseFloat() on money identifiers fail lint
 * This is a negative proof: the rule should catch violations
 */

import { describe, it, expect } from "vitest";
import * as path from "path";
import { ESLint } from "eslint";

describe("UZ5: Money ESLint Rule", () => {
  it("UZ5: ESLint rule rejects Number() and parseFloat() on money-named identifiers", () => {
    const violationCode = `
      const moneyString = "150.50";
      const amount = Number(moneyString);
      const price = parseFloat(moneyString);
    `;
    const root = path.resolve(process.cwd(), "..");
    const eslint = new ESLint({ cwd: root });
    return eslint.lintText(violationCode, { filePath: "web/src/money-eslint-violation.tmp.ts" })
      .then((results) => {
        const messages = results.flatMap((result) => result.messages.map((message) => message.message));
        expect(messages.join("\n").toLowerCase()).toMatch(/number|parsefloat/i);
      });
  });
});
