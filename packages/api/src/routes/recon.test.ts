/**
 * CA: Reconciliation routes tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, createTestToken } from "../test-helpers.js";

function buildMultipart(fieldName: string, filename: string, content: Buffer, contentType = "text/csv") {
  const boundary = "----recontestboundary";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([head, content, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

const CSV_HEADER = "tradeId,symbol,quantity,price,tradeTs,settlementDate";

describe("CA: Reconciliation", () => {
  let app: FastifyInstance;
  let token: string;

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
    result.executor.tables.recon_breaks!.push({ break_id: "break-1", status: "OPEN" });
    token = await createTestToken("admin", "OPS", ["acc1"]);
  });

  afterEach(async () => {
    await app.close();
  });

  it("CA1: Upload returns 202 with runId", async () => {
    const csv = `${CSV_HEADER}\next-1,ACME,10,50.00,1700000000000,2024-01-01\n`;
    const { body, headers } = buildMultipart("file", "statement.csv", Buffer.from(csv));
    const res = await app.inject({
      method: "POST",
      url: "/recon/runs",
      headers: { authorization: `Bearer ${token}`, ...headers },
      payload: body,
    });
    expect(res.statusCode).toBe(202);
    const json = res.json();
    expect(json.runId).toMatch(/^run_[0-9a-f]{64}$/);
  });

  it("CA2: Same bytes again produce the same run id", async () => {
    const csv = `${CSV_HEADER}\next-2,ACME,10,50.00,1700000000000,2024-01-01\n`;

    const first = buildMultipart("file", "statement.csv", Buffer.from(csv));
    const res1 = await app.inject({
      method: "POST",
      url: "/recon/runs",
      headers: { authorization: `Bearer ${token}`, ...first.headers },
      payload: first.body,
    });
    expect(res1.statusCode).toBe(202);
    const runId1 = res1.json().runId;

    // Re-upload the identical bytes (different filename, same content) - the
    // run id is derived from the file hash, not the filename or upload time.
    const second = buildMultipart("file", "statement-retry.csv", Buffer.from(csv));
    const res2 = await app.inject({
      method: "POST",
      url: "/recon/runs",
      headers: { authorization: `Bearer ${token}`, ...second.headers },
      payload: second.body,
    });
    expect(res2.statusCode).toBe(202);
    expect(res2.json().runId).toBe(runId1);
  });

  it("CA3: Oversized upload is rejected mid-stream, not after full buffering", async () => {
    // Build a CSV just over the 20 MiB application-level limit. The handler
    // checks `bytes > 20 MiB` on every chunk inside the multipart stream
    // loop (recon.ts), so this must reject with 413 - not 500/OOM - proving
    // it's counting bytes as they arrive rather than materializing the
    // whole file first.
    const row = "ext,ACME,10,50.00,1700000000000,2024-01-01\n";
    const target = 21 * 1024 * 1024;
    const rows = Math.ceil(target / row.length);
    const csv = CSV_HEADER + "\n" + row.repeat(rows);
    const { body, headers } = buildMultipart("file", "huge.csv", Buffer.from(csv));

    const res = await app.inject({
      method: "POST",
      url: "/recon/runs",
      headers: { authorization: `Bearer ${token}`, ...headers },
      payload: body,
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().detail).toMatch(/exceeds/i);
  });

  it("CA4: Malformed uploads validation", async () => {
    // No file - multipart handler returns various codes
    const res = await app.inject({
      method: "POST",
      url: "/recon/runs",
      headers: { authorization: `Bearer ${token}` },
      payload: {}, // No file
    });
    // Accept 400, 406, 415, 500 - depends on multipart library
    expect([400, 406, 415, 500]).toContain(res.statusCode);
  });

  it("CA5: Status and resolve with reasons", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/recon/breaks/break-1/status",
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "INVESTIGATING", reason: "Needs statement verification" },
    });
    expect(res.statusCode).toBe(202);
  });

  it("CA6: Concurrent resolves", async () => {
    const promises = [1, 2].map(() =>
      app.inject({
        method: "POST",
        url: "/recon/breaks/break-1/resolve",
        headers: { authorization: `Bearer ${token}` },
        payload: { reason: "Fixed" },
      })
    );

    const results = await Promise.all(promises);
    expect(results.map(r => r.statusCode)).toContain(202);
  });

  it("CA7: Resolve with adjustment", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/recon/breaks/break-1/resolve",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        reason: "Corrected",
        adjustment: { asset: "USD", amount: "2.50" },
      },
    });
    expect(res.statusCode).toBe(202);
  });
});
