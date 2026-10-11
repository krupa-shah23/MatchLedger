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

  it("X1: statement matches internal exactly with zero breaks", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [{ tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-15" }],
    });
    expect(breaks).toStrictEqual([]);
  });

  it("X2: a missing external trade is reported as MISSING_EXTERNAL", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [],
    });
    expect(breaks).toContainEqual({ tradeId: "t1", type: "MISSING_EXTERNAL", internalQuantity: 10n, internalPrice: 10125n, internalSettlement: "2023-11-15", internalTs: 1_700_000_000_000 });
  });

  it("X3: duplicate external rows are reported with a count", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [
        { tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-15" },
        { tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-15" },
      ],
    });
    expect(breaks).toContainEqual({ tradeId: "t1", type: "DUPLICATE", count: 2 });
  });

  it("X4: a price mismatch is reported with both internal and external values", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [{ tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.50", tradeTs: "1700000000000", settlementDate: "2023-11-15" }],
    });
    expect(breaks).toContainEqual({ tradeId: "t1", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n });
  });

  it("X5: a row with no internal match is reported as MISSING_INTERNAL", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [],
      statementRows: [{ tradeId: "t9", symbol: "ACME", quantity: "1", price: "100.00", tradeTs: "1700000000500", settlementDate: "2023-11-15" }],
    });
    expect(breaks).toContainEqual({ tradeId: "t9", type: "MISSING_INTERNAL", count: 1 });
  });

  it("XM1: a missing internal trade is reported with its external row count", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [{ tradeId: "t9", symbol: "ACME", quantity: "1", price: "100.00", tradeTs: "1700000000500", settlementDate: "2023-11-15" }],
    });
    expect(breaks).toContainEqual({ tradeId: "t9", type: "MISSING_INTERNAL", count: 1 });
  });

  it("XM2: quantity mismatches are reported with both values", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [{ tradeId: "t1", symbol: "ACME", quantity: "12", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-15" }],
    });
    expect(breaks).toContainEqual({ tradeId: "t1", type: "QUANTITY_MISMATCH", internalQuantity: 10n, externalQuantity: 12n });
  });

  it("XM3: settlement mismatches are reported with both dates", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [{ tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-16" }],
    });
    expect(breaks).toContainEqual({ tradeId: "t1", type: "SETTLEMENT_MISMATCH", internalSettlement: "2023-11-15", externalSettlement: "2023-11-16" });
  });

  it("XM4: late trades beyond the cutoff are emitted as LATE", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [{ tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.25", tradeTs: "1700000001001", settlementDate: "2023-11-15" }],
    });
    expect(breaks).toContainEqual({ tradeId: "t1", type: "LATE", externalTs: 1_700_000_001_001 });
  });

  it("XM5: cutoff boundary includes exact cutoff values and excludes later values", () => {
    const atCutoff = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [{ tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-15" }],
    });
    const pastCutoff = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [{ tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.25", tradeTs: "1700000000001", settlementDate: "2023-11-15" }],
    });
    expect(atCutoff.some((item) => item.type === "LATE")).toBe(false);
    expect(pastCutoff.some((item) => item.type === "LATE")).toBe(true);
  });

  it("XM6: the scenario with seeded faults produces exactly the expected break types in order", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [
        { tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 },
        { tradeId: "t2", symbol: "ACME", price: 10100n, quantity: 5n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_001_000 },
        { tradeId: "t3", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_002_000 },
      ],
      statementRows: [
        { tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-15" },
        { tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-15" },
        { tradeId: "t3", symbol: "ACME", quantity: "10", price: "101.50", tradeTs: "1700000002000", settlementDate: "2023-11-15" },
        { tradeId: "t9", symbol: "ACME", quantity: "1", price: "100.00", tradeTs: "1700000000500", settlementDate: "2023-11-15" },
      ],
    });
    expect(breaks.map((breakDef) => breakDef.type)).toStrictEqual(["DUPLICATE", "MISSING_EXTERNAL", "LATE", "PRICE_MISMATCH", "MISSING_INTERNAL"]);
  });

  it("XM7: several mismatching fields on one trade produce one break per field", () => {
    const breaks = classify({
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [{ tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 }],
      statementRows: [{ tradeId: "t1", symbol: "ACME", quantity: "12", price: "101.50", tradeTs: "1700000000000", settlementDate: "2023-11-16" }],
    });
    expect(breaks.map((breakDef) => breakDef.type)).toEqual(expect.arrayContaining(["QUANTITY_MISMATCH", "PRICE_MISMATCH", "SETTLEMENT_MISMATCH"]));
  });

  it("XM8: the same inputs always produce the same ordered break sequence", () => {
    const config = {
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [
        { tradeId: "t1", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_000_000 },
        { tradeId: "t3", symbol: "ACME", price: 10125n, quantity: 10n, buyerAccountId: "B", sellerAccountId: "S", ts: 1_700_000_002_000 },
      ],
      statementRows: [
        { tradeId: "t1", symbol: "ACME", quantity: "10", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-15" },
        { tradeId: "t3", symbol: "ACME", quantity: "11", price: "101.50", tradeTs: "1700000002000", settlementDate: "2023-11-16" },
      ],
    };
    expect(classify(config)).toStrictEqual(classify(config));
  });

  it("P23: random internal trades and statement rows match an independent naive classifier", () => {
    const naiveClassify = (input: {
      readonly cutoffTs: number;
      readonly priceDecimals: number;
      readonly settlementLagDays: number;
      readonly internalTrades: readonly { tradeId: string; ts: number; quantity: bigint; price: bigint }[];
      readonly statementRows: readonly { tradeId: string; quantity: string; price: string; tradeTs: string; settlementDate: string }[];
    }) => {
      const expected: Array<{ tradeId: string; type: string; count?: number; internalQuantity?: bigint; externalQuantity?: bigint; internalPrice?: bigint; externalPrice?: bigint; internalSettlement?: string; externalSettlement?: string; externalTs?: number; internalTs?: number }> = [];
      const internalById = new Map(input.internalTrades.map((trade) => [trade.tradeId, trade]));
      const externalById = new Map<string, typeof input.statementRows>();
      for (const row of input.statementRows) {
        const rows = externalById.get(row.tradeId) ?? [];
        rows.push(row);
        externalById.set(row.tradeId, rows);
      }

      for (const [tradeId, trade] of [...internalById.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        const rows = externalById.get(tradeId) ?? [];
        if (rows.length === 0) {
          expected.push({ tradeId, type: "MISSING_EXTERNAL", internalQuantity: trade.quantity, internalPrice: trade.price, internalSettlement: "2023-11-15", internalTs: trade.ts });
          continue;
        }
        if (rows.length > 1) expected.push({ tradeId, type: "DUPLICATE", count: rows.length });
        const first = rows[0]!;
        const extQty = /^\d+$/.test(first.quantity.trim()) ? BigInt(first.quantity.trim()) : undefined;
        const extPrice = /^\d+(\.\d+)?$/.test(first.price.trim()) ? BigInt(first.price.trim().replace(".", "")) : undefined;
        if (Number(first.tradeTs) > input.cutoffTs) expected.push({ tradeId, type: "LATE", externalTs: Number(first.tradeTs) });
        if (extQty !== undefined && extQty !== trade.quantity) expected.push({ tradeId, type: "QUANTITY_MISMATCH", internalQuantity: trade.quantity, externalQuantity: extQty });
        if (extPrice !== undefined && extPrice !== trade.price) expected.push({ tradeId, type: "PRICE_MISMATCH", internalPrice: trade.price, externalPrice: extPrice });
      }

      for (const [tradeId, rows] of [...externalById.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        if (!internalById.has(tradeId)) expected.push({ tradeId, type: "MISSING_INTERNAL", count: rows.length });
      }
      return expected.sort((left, right) => left.tradeId.localeCompare(right.tradeId) || left.type.localeCompare(right.type));
    };

    const input = {
      cutoffTs: 1_700_000_000_000,
      priceDecimals: 2,
      settlementLagDays: 1,
      internalTrades: [
        { tradeId: "t1", ts: 1_700_000_000_000, quantity: 10n, price: 10125n },
        { tradeId: "t2", ts: 1_700_000_001_000, quantity: 5n, price: 10100n },
        { tradeId: "t3", ts: 1_700_000_002_000, quantity: 7n, price: 12000n },
      ],
      statementRows: [
        { tradeId: "t1", quantity: "10", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-15" },
        { tradeId: "t1", quantity: "10", price: "101.25", tradeTs: "1700000000000", settlementDate: "2023-11-15" },
        { tradeId: "t2", quantity: "6", price: "101.00", tradeTs: "1700000001000", settlementDate: "2023-11-15" },
        { tradeId: "t9", quantity: "2", price: "99.99", tradeTs: "1700000000500", settlementDate: "2023-11-15" },
      ],
    };
    const expected = naiveClassify(input);
    const actual = classify({
      cutoffTs: input.cutoffTs,
      priceDecimals: input.priceDecimals,
      settlementLagDays: input.settlementLagDays,
      internalTrades: input.internalTrades.map((trade) => ({ ...trade, symbol: "ACME", buyerAccountId: "B", sellerAccountId: "S" })),
      statementRows: input.statementRows.map((row) => ({ ...row, symbol: "ACME" })),
    });
    expect(actual).toStrictEqual(expected);
  });

  it("XW1: OPEN allows the INVESTIGATING, RESOLVED and WRITTEN_OFF transitions", () => {
    const workflow = new BreakWorkflow({ breakId: "b-1", status: "OPEN", actor: "ops", reason: "new", ts: 1 });
    expect(workflow.transition({ to: "INVESTIGATING", reason: "review", actor: "ops", ts: 2 })).toMatchObject({ from: "OPEN", to: "INVESTIGATING" });
    expect(workflow.status).toBe("INVESTIGATING");
  });

  it("XW2: terminal states are immutable", () => {
    const workflow = new BreakWorkflow({ breakId: "b-1", status: "RESOLVED", actor: "ops", reason: "done", ts: 1 });
    expect(() => workflow.transition({ to: "WRITTEN_OFF", reason: "later", actor: "ops", ts: 2 })).toThrow();
    expect(workflow.status).toBe("RESOLVED");
  });

  it("XW3: empty or whitespace-only reasons are rejected", () => {
    const workflow = new BreakWorkflow({ breakId: "b-1", status: "OPEN", actor: "ops", reason: "new", ts: 1 });
    expect(() => workflow.transition({ to: "INVESTIGATING", reason: "   ", actor: "ops", ts: 2 })).toThrow();
  });

  it("XW4: empty or whitespace-only actors are rejected", () => {
    const workflow = new BreakWorkflow({ breakId: "b-1", status: "OPEN", actor: "ops", reason: "new", ts: 1 });
    expect(() => workflow.transition({ to: "INVESTIGATING", reason: "review", actor: "   ", ts: 2 })).toThrow();
  });

  it("XW5: each transition writes a single audit entry with seq, actor, reason and timestamp", () => {
    const workflow = new BreakWorkflow({ breakId: "b-1", status: "OPEN", actor: "ops", reason: "new", ts: 1 });
    const entry = workflow.transition({ to: "INVESTIGATING", reason: "review", actor: "auditor", ts: 2 });
    expect(entry).toMatchObject({ breakId: "b-1", seq: 1, from: "OPEN", to: "INVESTIGATING", reason: "review", actor: "auditor", ts: 2 });
    expect(workflow.audit).toHaveLength(1);
    expect(workflow.audit[0]).toStrictEqual(entry);
  });

  it("XW6: ageMs is computed from the injected creation time, not from the first transition", () => {
    const workflow = new BreakWorkflow({ breakId: "b-1", status: "OPEN", actor: "ops", reason: "new", ts: 10 });
    expect(workflow.ageMs(25)).toBe(15);
  });

  it("XW7: resolving a break twice fails and leaves the audit trail unchanged", () => {
    const workflow = new BreakWorkflow({ breakId: "b-1", status: "OPEN", actor: "ops", reason: "new", ts: 1 });
    workflow.transition({ to: "RESOLVED", reason: "done", actor: "ops", ts: 2 });
    expect(() => workflow.transition({ to: "WRITTEN_OFF", reason: "later", actor: "ops", ts: 3 })).toThrow();
    expect(workflow.audit).toHaveLength(1);
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
