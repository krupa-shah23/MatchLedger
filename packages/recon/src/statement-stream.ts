import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

export async function hashStatement(readable: Readable): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of readable) {
    hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"));
  }
  return hash.digest("hex");
}

export async function streamRows(readable: Readable): Promise<{ readonly rows: readonly string[][]; readonly hash: string }> {
  const chunks: Buffer[] = [];
  const hash = createHash("sha256");
  for await (const chunk of readable) {
    const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
    chunks.push(next);
    hash.update(next);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  const rows = (text || "").split(/\r?\n/).filter((line) => line.trim() !== "").map((line) => line.split(","));
  return { rows, hash: hash.digest("hex") };
}
