import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export async function findRepositoryRoot(start = process.cwd()): Promise<string> {
  let directory = resolve(start);
  while (true) {
    try {
      const manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8")) as {
        workspaces?: unknown;
      };
      if (Array.isArray(manifest.workspaces) && manifest.workspaces.includes("packages/*")) return directory;
    } catch {
      // Keep walking until the workspace root or filesystem root is reached.
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`could not locate the MatchLedger workspace above ${start}`);
    directory = parent;
  }
}
