#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Patterns that apply to every line, regardless of comment or string context.
const codePatterns = [
  { pattern: /\bit\.todo\b/, name: "it.todo" },
  { pattern: /\bit\.skip\b/, name: "it.skip" },
  { pattern: /\btest\.todo\b/, name: "test.todo" },
  { pattern: /\btest\.skip\b/, name: "test.skip" },
  { pattern: /\bdescribe\.skip\b/, name: "describe.skip" },
  { pattern: /\bxit\b/, name: "xit" },
  { pattern: /\bxdescribe\b/, name: "xdescribe" },
  { pattern: /\b(?:it|test|describe)\.only\s*\(/, name: ".only" },
  { pattern: /\bTODO\b/, name: "TODO comment" },
  { pattern: /\bFIXME\b/, name: "FIXME comment" },
  { pattern: /\bXXX\b/, name: "XXX comment" },
  { pattern: /\bHACK\b/, name: "HACK comment" },
  { pattern: /["']placeholder["']/i, name: "placeholder string" },
  { pattern: /\bstub\b/i, name: "stub" },
  { pattern: /["'].*not implemented.*["']/i, name: "not implemented string" },
  { pattern: /["'].*coming soon.*["']/i, name: "coming soon string" },
  { pattern: /["'].*mock data.*["']/i, name: "mock data string" },
  { pattern: /["'].*\bdummy\b.*["']/i, name: "dummy string" },
  { pattern: /\blorem ipsum\b/i, name: "lorem ipsum" },
];

// Comment-form-only patterns: these words are common in plain prose/strings
// (e.g. "temporary hold", "for now" in a user-facing sentence), so they only
// count as placeholder violations when they appear inside a // or /* ... */
// style comment, where a developer is explicitly flagging unfinished work.
const commentOnlyPatterns = [
  { pattern: /\bfor now\b/i, name: "'for now' comment" },
  { pattern: /\btemporary\b/i, name: "'temporary' comment" },
];

function isCommentLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    /\/\/[^"'`]*$/.test(line) // a trailing // comment with no string literal after it
  );
}

// Detects a function/arrow body whose ENTIRE implementation is a single
// hardcoded literal return (`return true;`, `return 200;`, `=> true`),
// which is the shape of a handler that always answers the same way instead
// of computing a real result. Deliberately narrow (single-statement bodies
// only) to avoid flagging legitimate one-line helpers that return a
// genuinely constant, named value (e.g. `export const MAX = () => 100;`
// style config getters are not matched since this requires the literal
// `true`/`false`/`200`/`0`).
const constantReturnPattern =
  /(?:function[^(]*\([^)]*\)\s*(?::\s*[^{=]+)?\s*\{\s*return\s+(?:true|false|200)\s*;?\s*\}|=>\s*\{\s*return\s+(?:true|false|200)\s*;?\s*\}\s*[,;)]?)/;

function hasDocumentedSkipReason(lines, lineIndex) {
  const firstCandidate = Math.max(0, lineIndex - 12);
  for (let i = lineIndex - 1; i >= firstCandidate; i--) {
    const previous = lines[i].trim();
    if (/SKIPPED[^\n]*Reason:/i.test(previous)) return true;
    if (previous && !previous.startsWith("//") && !previous.startsWith("*")) break;
  }
  return false;
}

function findTsFiles() {
  try {
    const output = execSync("git ls-files --cached --others --exclude-standard -- '*.ts' '*.tsx'", { encoding: "utf-8" });
    return Array.from(new Set(output.trim().split("\n"))).filter((f) => f.length > 0 && fs.existsSync(f));
  } catch {
    // Fallback: walk the directory
    const files = [];
    function walk(dir) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item.startsWith(".")) continue;
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (!["node_modules", "dist", "dist-test", ".git"].includes(item)) {
            walk(full);
          }
        } else if (item.endsWith(".ts") || item.endsWith(".tsx")) {
          files.push(full);
        }
      }
    }
    walk(".");
    return files;
  }
}

// This checker's own meta-test (scripts/check-no-placeholders.test.ts)
// legitimately writes "it.todo" etc. as literal text — in its own assertions
// and in a seeded fixture file it creates to prove the checker catches a
// real violation — so it is excluded from the scan rather than flagged.
const SELF_EXCLUDED_FILES = new Set(["scripts/check-no-placeholders.test.ts"]);

const files = findTsFiles().filter((f) => !SELF_EXCLUDED_FILES.has(f));
const violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  const lines = content.split("\n");
  const isTestFile = /\.test\.tsx?$/.test(file);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { pattern, name } of codePatterns) {
      if (pattern.test(line)) {
        const isSkip = name === "it.skip" || name === "test.skip" || name === "describe.skip";
        if (isSkip && isTestFile && hasDocumentedSkipReason(lines, i)) continue;
        violations.push({ file, line: i + 1, pattern: name, content: line.trim().substring(0, 80) });
      }
    }

    if (isCommentLine(line)) {
      for (const { pattern, name } of commentOnlyPatterns) {
        if (pattern.test(line)) {
          violations.push({ file, line: i + 1, pattern: name, content: line.trim().substring(0, 80) });
        }
      }
    }

    // Constant-returning handlers: skip test files, where a fixed return
    // value is often a legitimate fake/mock for a dependency under test.
    if (!isTestFile && constantReturnPattern.test(line)) {
      violations.push({
        file,
        line: i + 1,
        pattern: "constant-returning handler",
        content: line.trim().substring(0, 80),
      });
    }
  }
}

if (violations.length > 0) {
  console.error("❌ Placeholder violations found:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.pattern}]`);
    console.error(`    ${v.content}`);
  }
  process.exit(1);
} else {
  console.log("✅ No placeholders detected");
  process.exit(0);
}
