import { createHash } from "node:crypto";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { RecordParser, parseCsvText, parsePriceMinor } from "./csv.js";
import { civilFromDays, settlementDate } from "./dates.js";
import { classify } from "./matcher.js";
import { BreakWorkflow } from "./workflow.js";

describe("recon contract", () => {
  it("PA1: simple file parses the header and rows without dropping data", () => {
    const result = parseCsvText("tradeId,symbol,quantity,price,tradeTs,settlementDate\nt1,ACME,10,101.25,1700000000000,2023-11-15\nt2,ACME,5,101.00,1700000001000,2023-11-15\n");
    expect(result.rows).toStrictEqual([
      ["tradeId", "symbol", "quantity", "price", "tradeTs", "settlementDate"],
      ["t1", "ACME", "10", "101.25", "1700000000000", "2023-11-15"],
      ["t2", "ACME", "5", "101.00", "1700000001000", "2023-11-15"],
    ]);
    expect(result.errors).toStrictEqual([]);
  });

  it("PA2: CRLF, LF, BOM and blank lines parse identically", () => {
    const lf = "tradeId,symbol\n\nT1,ACME\n\nT2,MSFT\n";
    const crlf = "tradeId,symbol\r\n\r\nT1,ACME\r\n\r\nT2,MSFT\r\n";
    const bom = `\uFEFFtradeId,symbol\nT1,ACME\nT2,MSFT\n`;
    expect(parseCsvText(lf).rows).toStrictEqual(parseCsvText(crlf).rows);
    expect(parseCsvText(bom).rows).toStrictEqual(parseCsvText(lf).rows);
    expect(parseCsvText(lf).rows).toStrictEqual([
      ["tradeId", "symbol"],
      ["T1", "ACME"],
      ["T2", "MSFT"],
    ]);
  });

  it("PA3: quoted fields with commas and escaped quotes stay intact", () => {
    const result = parseCsvText('tradeId,notes,quote\n"t1","ACME, Inc.","He said ""hello"""\n');
    expect(result.rows).toStrictEqual([
      ["tradeId", "notes", "quote"],
      ["t1", "ACME, Inc.", 'He said "hello"'],
    ]);
    expect(result.errors).toStrictEqual([]);
  });

  it("PA4: chunked input produces the same rows as a single-string parse", () => {
    const text = 'tradeId,symbol,quantity\n"t1","ACME, Inc.",10\n"t2","MSFT",5\n';
    const parser = new RecordParser();
    parser.push(text);
    const expected = parser.finish();
    for (const split of [1, 2, 3, 5, 7, 11, 17]) {
      const chunked = new RecordParser();
      for (let index = 0; index < text.length; index += split) {
        chunked.push(text.slice(index, index + split));
      }
      expect(chunked.finish()).toStrictEqual(expected);
    }
    expect(expected).toStrictEqual([
      ["tradeId", "symbol", "quantity"],
      ["t1", "ACME, Inc.", "10"],
      ["t2", "MSFT", "5"],
    ]);
  });

  it("PA5: empty input, header-only input and ragged rows are represented without crashing", () => {
    expect(parseCsvText("").rows).toStrictEqual([]);
    expect(parseCsvText("tradeId,symbol\n").rows).toStrictEqual([["tradeId", "symbol"]]);
    const ragged = parseCsvText("tradeId,symbol\nT1,ACME,extra\nT2\n");
    expect(ragged.rows).toStrictEqual([
      ["tradeId", "symbol"],
      ["T1", "ACME", "extra"],
      ["T2"],
    ]);
  });

  it("PA6: malformed quoted fields are reported as row errors instead of crashing", () => {
    const result = parseCsvText('tradeId,notes\n"unterminated\n');
    expect(result.errors).toContainEqual({ rowNumber: 2, reason: "unterminated quoted field" });
    expect(result.rows).toStrictEqual([
      ["tradeId", "notes"],
      ["unterminated"],
    ]);
  });

  it("PA7: invalid UTF-8 bytes are surfaced as a parse error rather than a crash", () => {
    const parser = new RecordParser();
    expect(() => parser.push(new Uint8Array([0xff, 0xfe, 0x00, 0x41]))).not.toThrow();
    expect(parser.getErrors()).toContainEqual({ rowNumber: 1, reason: "invalid utf-8" });
  });

  it("PA8: price decimals are parsed exactly and reject sub-decimal precision beyond the configured scale", () => {
    expect(parsePriceMinor("101.25", 2)).toBe(10125n);
    expect(parsePriceMinor("101.255", 2)).toBeUndefined();
    expect(parsePriceMinor("101", 0)).toBe(101n);
    expect(parsePriceMinor("101.00", 0)).toBeUndefined();
    expect(parsePriceMinor("-12.34", 2)).toBe(-1234n);
  });

  it("PA9: streaming writes are stable across fragment boundaries", () => {
    const text = 'tradeId,symbol,quantity\n"t1","ACME, Inc.",10\n"t2","MSFT",5\n';
    const frameA = new RecordParser();
    const frameB = new RecordParser();
    const chunks = [text.slice(0, 12), text.slice(12, 29), text.slice(29, 45), text.slice(45)];
    for (const chunk of chunks) {
      frameA.push(chunk);
    }
    const allAtOnce = new RecordParser();
    allAtOnce.push(text);
    expect(frameA.finish()).toStrictEqual(allAtOnce.finish());
  });

  it("PA10: the same source content has the same SHA-256 regardless of chunking", () => {
    const text = 'tradeId,symbol,quantity\n"t1","ACME, Inc.",10\n"t2","MSFT",5\n';
    const hashA = createHash("sha256").update(text).digest("hex");
    const hashB = createHash("sha256");
    const chunks = [text.slice(0, 11), text.slice(11, 31), text.slice(31)];
    for (const chunk of chunks) {
      hashB.update(chunk);
    }
    expect(hashB.digest("hex")).toBe(hashA);
  });

  it("DT1: civilFromDays matches the expected dates for reference vectors", () => {
    expect(civilFromDays(0)).toEqual({ year: 1970, month: 1, day: 1 });
    expect(civilFromDays(19675n)).toEqual({ year: 2023, month: 11, day: 14 });
    expect(civilFromDays(19723n)).toEqual({ year: 2024, month: 1, day: 1 });
    expect(civilFromDays(11017n)).toEqual({ year: 2000, month: 3, day: 1 });
    expect(civilFromDays(-1n)).toEqual({ year: 1969, month: 12, day: 31 });
  });

  it("DT2: settlementDate produces the correct ISO date for a timestamp and lag", () => {
    expect(settlementDate(1_700_000_000_000, 1)).toBe("2023-11-15");
    expect(settlementDate(1_700_000_000_000, 0)).toBe("2023-11-14");
    expect(settlementDate(0, 1)).toBe("1970-01-02");
  });

  it("DT3: settlementDate matches the Date.UTC reference for random timestamps", () => {
    fc.assert(
      fc.property(fc.integer({ min: -10_000_000_000, max: 10_000_000_000 }), fc.integer({ min: 0, max: 5 }), (ts, lag) => {
        const days = Math.floor(ts / 86_400_000);
        const reference = new Date(Date.UTC(1970, 0, 1) + days * 86_400_000);
        const shifted = new Date(Date.UTC(1970, 0, 1) + (days + lag) * 86_400_000);
        const expectedSettlement = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
        expect(settlementDate(ts, lag)).toBe(expectedSettlement);
        expect(civilFromDays(days + lag)).toEqual({
          year: shifted.getUTCFullYear(),
          month: shifted.getUTCMonth() + 1,
          day: shifted.getUTCDate(),
        });
      }),
      { numRuns: 100 }
    );
  });

  it("workflow enforces legal transitions and audit trail", () => {
    const workflow = new BreakWorkflow({ breakId: "b-1", status: "OPEN", actor: "ops", reason: "new", ts: 1 });
    expect(() => workflow.transition({ to: "RESOLVED", reason: "resolved", actor: "ops", ts: 2 })).not.toThrow();
    expect(workflow.status).toBe("RESOLVED");
    expect(workflow.audit).toHaveLength(1);
    expect(() => workflow.transition({ to: "OPEN", reason: "invalid", actor: "ops", ts: 3 })).toThrow();
  });

  it("classifies mismatches deterministically", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [
        { tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 },
        { tradeId: "t2", symbol: "ACME", price: 10100n, quantity: 5n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_001_000 },
      ],
      statementRows: [
        { tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.50", tradeTs: "1700000000000", settlementDate: "2023-11-15" },
        { tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.50", tradeTs: "1700000000000", settlementDate: "2023-11-15" },
        { tradeId: "t9", symbol: "ACME", quantity: "1", price: "100.00", tradeTs: "1700000000500", settlementDate: "2023-11-15" },
      ],
    });
    expect(breaks.map((breakDef) => breakDef.type)).toContain("DUPLICATE");
    expect(breaks.map((breakDef) => breakDef.type)).toContain("PRICE_MISMATCH");
    expect(breaks.map((breakDef) => breakDef.type)).toContain("MISSING_INTERNAL");
  });
});
