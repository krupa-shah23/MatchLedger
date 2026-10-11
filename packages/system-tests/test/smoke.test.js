import { describe, expect, it } from "vitest";
import { BoundedQueue, partitionOf } from "@matchledger/common";
import { RiskCore } from "@matchledger/risk";
import { wirePipeline } from "../src/wire.js";
describe("system-tests smoke", () => {
    it("imports resolve across the allowed package graph", () => {
        const queue = new BoundedQueue(2);
        const value = partitionOf("acct-1", 4);
        const command = {
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
        expect(queue.enqueue("ready")).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(command.orderId).toBe("o-1");
        expect(typeof RiskCore).toBe("function");
        expect(wirePipeline()).toContain("risk-stage");
    });
});
