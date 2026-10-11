import { describe, expect, it } from "vitest";

import { RecordParser, parsePriceMinor } from "./csv.js";
import { civilFromDays, settlementDate } from "./dates.js";
import { classify } from "./matcher.js";
import { BreakWorkflow } from "./workflow.js";

describe("recon contract", () => {
  it("parses csv and price decimals", () => {
    const parser = new RecordParser();
    parser.push("tradeId,symbol,quantity,price,tradeTs,settlementDate\n");
    parser.push("t1,ACME,10,101.25,1700000000000,2023-11-15\n");
    parser.push("t2,ACME,5,101.00,1700000001000,2023-11-15\n");
    const rows = parser.finish();
    expect(rows).toHaveLength(3);
    expect(parsePriceMinor("101.25", 2)).toBe(10125n);
    expect(parsePriceMinor("101.255", 2)).toBeUndefined();
  });

  it("computes civil dates without Date", () => {
    expect(civilFromDays(0)).toEqual({ year: 1970, month: 1, day: 1 });
    expect(settlementDate(1_700_000_000_000, 1)).toBe("2023-11-15");
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

  it("workflow enforces legal transitions and audit trail", () => {
    const workflow = new BreakWorkflow({ breakId: "b-1", status: "OPEN", actor: "ops", reason: "new", ts: 1 });
    expect(() => workflow.transition({ to: "RESOLVED", reason: "resolved", actor: "ops", ts: 2 })).not.toThrow();
    expect(workflow.status).toBe("RESOLVED");
    expect(workflow.audit).toHaveLength(1);
    expect(() => workflow.transition({ to: "OPEN", reason: "invalid", actor: "ops", ts: 3 })).toThrow();
  });
});
