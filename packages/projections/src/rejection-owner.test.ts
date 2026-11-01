import { it, expect } from "vitest";
import { Projector, type ProjectorDeps } from "./projector.js";
import { NoticeBus } from "./notices.js";

for (const eventType of ["ORDER_REJECTED", "OrderRejected"]) {
  it(`projects ${eventType} with the submitted order owner`, async () => {
    const inserts: unknown[][] = [];
    const executor: ProjectorDeps["executor"] = {
      async query(sql, params) {
        if (sql.includes("FROM journal")) return { rows: [{ seq: 1, idx: 0, ts: 1, symbol: "ACME", record_type: "EVENT", payload_json: { type: eventType, orderId: "order-1", reason: "INVALID_PRICE" } }] };
        if (sql.includes("SELECT account_id FROM orders_view")) {
          expect(params).toEqual(["order-1"]);
          return { rows: [{ account_id: "account-1" }] };
        }
        if (sql.includes("INSERT INTO rejections_view")) inserts.push(params);
        return { rows: [{ last_seq: 0 }] };
      },
      async transaction(fn) { return fn(executor); },
    };
    const projector = new Projector({ executor, noticeBus: new NoticeBus() });
    expect(await projector.runOnce("ACME")).toBe(1);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.slice(0, 5)).toEqual(["MATCHER", "order-1", "account-1", "ACME", "INVALID_PRICE"]);
  });
}
