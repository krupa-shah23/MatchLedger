import { it, expect } from "vitest";
import { mapEngineRecord } from "./mappers.js";
it("trade and fill timestamps use journal time rather than sequence", () => {
  const ts = 1793520000000;
  const mutations = mapEngineRecord({ record_type: "EVENT", symbol: "ACME", seq: 42, ts, payload_json: { type: "TradeExecuted", tradeId: "t", takerOrderId: "buy", makerOrderId: "sell", price: 100n, quantity: 1n, takerSide: "BUY" } });
  const timed = mutations.filter(m => m.type === "INSERT_FILL" || m.type === "INSERT_TRADE");
  expect(timed).toHaveLength(3);
  for (const m of timed) if (m.type === "INSERT_FILL" || m.type === "INSERT_TRADE") expect(m.data.ts).toBe(ts);
});
