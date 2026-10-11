import { describe, expect, it } from "vitest";

import { BoundedQueue, partitionOf } from "@matchledger/common";
import type { PlaceOrder } from "@matchledger/engine-core";
import { RiskCore } from "@matchledger/risk";
import { wirePipeline } from "../src/wire.js";

describe("system-tests smoke", () => {
  it("imports resolve across the allowed package graph", () => {
    const queue = new BoundedQueue<string>(2);
    const value = partitionOf("acct-1", 4);
    const command: PlaceOrder = {
      kind: "PLACE",
      ts: 0n,
      orderId: "o-1",
      accountId: "acct-1",
      side: "BUY",
      orderType: "IOC",
      timeInForce: "IOC",
      price: 101n,
      quantity: 1n,
    };
    expect(queue.tryEnqueue("ready")).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(command.orderId).toBe("o-1");
    expect(typeof RiskCore).toBe("function");
    expect(wirePipeline()).toContain("risk-stage");
  });

  it("X6: Scenario 5 t3 resolves end to end in risk -> ledger -> break status order", async () => {
    const workflow = { status: "OPEN" as const, breakId: "t3" };
    const ledger = new Map<string, bigint>([["BUYER:CASH", 1_000n], ["@SUSPENSE:CASH", 0n]]);
    const risk = new Map<string, bigint>([["BUYER:CASH", 1_000n], ["@SUSPENSE:CASH", 0n]]);
    const order: string[] = [];

    const executor = async (input: { adjustmentId: string; accountId: string; asset: string; amount: bigint; side: "BUYER" | "SELLER" }) => {
      order.push("risk");
      risk.set(`${input.accountId}:${input.asset}`, (risk.get(`${input.accountId}:${input.asset}`) ?? 0n) + input.amount);
      order.push("ledger");
      ledger.set(`${input.accountId}:${input.asset}`, (ledger.get(`${input.accountId}:${input.asset}`) ?? 0n) + input.amount);
      ledger.set(`@SUSPENSE:${input.asset}`, (ledger.get(`@SUSPENSE:${input.asset}`) ?? 0n) - input.amount);
      order.push("break");
      workflow.status = "RESOLVED";
      return { accepted: true };
    };

    const result = await (await import("../../recon/src/service.js")).resolveBreak({
      workflow,
      breakDef: { tradeId: "t3", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n, internalQuantity: 10n, externalQuantity: 10n },
      actor: "ops",
      reason: "price mismatch",
      adjustment: { adjustmentId: "adj-t3", accountId: "BUYER", asset: "CASH", amount: -250n, side: "BUYER" },
      executor,
    });

    expect(order).toStrictEqual(["risk", "ledger", "break"]);
    expect(risk.get("BUYER:CASH")).toBe(750n);
    expect(ledger.get("BUYER:CASH")).toBe(750n);
    expect(ledger.get("@SUSPENSE:CASH")).toBe(250n);
    expect(result.status).toBe("RESOLVED");
    expect(result.workflow.status).toBe("RESOLVED");

    const rejected = await (await import("../../recon/src/service.js")).resolveBreak({
      workflow: { breakId: "t3", status: "OPEN" },
      breakDef: { tradeId: "t3", type: "PRICE_MISMATCH", internalPrice: 10125n, externalPrice: 10150n, internalQuantity: 10n, externalQuantity: 10n },
      actor: "ops",
      reason: "zero amount",
      adjustment: { adjustmentId: "adj-bad", accountId: "BUYER", asset: "CASH", amount: 0n, side: "BUYER" },
      executor: async () => ({ accepted: false, reason: "ZERO_AMOUNT" }),
    });

    expect(rejected.status).toBe("ADJUSTMENT_REJECTED");
    expect(rejected.workflow.status).toBe("OPEN");
  });
});
