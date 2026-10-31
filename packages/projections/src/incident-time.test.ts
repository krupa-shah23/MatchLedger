import { it, expect } from "vitest";
import { mapRiskRecord } from "./mappers.js";

it("incident timestamps come from the journal's time input rather than its sequence", () => {
  const ts = 1793420000000;
  const mutations = mapRiskRecord({ record_type: "EVENT", seq: 12, ts,
    payload_json: { type: "SymbolStatusChanged", symbol: "ACME", status: "HALTED", reason: "review" } });
  expect(mutations).toEqual([{ type: "UPDATE_BREAKER", symbol: "ACME", data: {
    state: "OPEN", trip_reason: "review", state_since_ts: ts, incident_start_ts: ts,
  } }]);
});
