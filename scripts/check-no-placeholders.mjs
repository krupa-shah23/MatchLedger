#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const patterns = [
  { pattern: /\bit\.todo\b/, name: "it.todo" },
  { pattern: /\bit\.skip\b/, name: "it.skip" },
  { pattern: /\bxit\b/, name: "xit" },
  { pattern: /\bxdescribe\b/, name: "xdescribe" },
  { pattern: /\bTODO\b/, name: "TODO comment" },
  { pattern: /["']placeholder["']/i, name: "placeholder string" },
  { pattern: /["']NOT IMPLEMENTED["']/i, name: "NOT IMPLEMENTED string" },
];

function findTsFiles() {
  try {
    const output = execSync("git ls-files --cached --exclude-standard -- '*.ts' '*.tsx'", { encoding: "utf-8" });
    return output.trim().split("\n").filter((f) => f.length > 0);
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

const files = findTsFiles();
let violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, name } of patterns) {
      if (pattern.test(line)) {
        violations.push({
          file,
          line: i + 1,
          pattern: name,
          content: line.trim().substring(0, 80),
        });
      }
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
