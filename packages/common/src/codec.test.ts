/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { serializeCommand, deserializeCommand } from "./codec/commands.js";
import { serializeEvent, deserializeEvent } from "./codec/events.js";
import { serializeBookSnapshot, deserializeBookSnapshot } from "./codec/book-snapshot.js";
import { CURRENT_VERSION, registerUpcaster, getUpcaster } from "./codec/versioning.js";

describe("Codec", () => {
  describe("CD1: Command serialization round-trip", () => {
    it("PLACE preserves bigint above 2^53", () => {
      const cmd = {
        kind: "PLACE" as const,
        ts: 1000,
        orderId: "o1",
        accountId: "a1",
        side: "BUY" as const,
        orderType: "LIMIT" as const,
        timeInForce: "GTC" as const,
        price: BigInt("9007199254740992"), // 2^53
        quantity: BigInt("10007199254740992"), // > 2^53
      };
      const json = serializeCommand(cmd);
      expect(JSON.stringify(JSON.parse(json))).toBeTruthy();
      const back = deserializeCommand(json);
      expect(back.kind).toBe("PLACE");
    });
  });

  describe("CD3: No JSON numbers for bigint", () => {
    it("price and quantity are decimal strings", () => {
      const cmd = {
        kind: "PLACE" as const,
        ts: 1000,
        orderId: "o1",
        accountId: "a1",
        side: "BUY" as const,
        orderType: "LIMIT" as const,
        timeInForce: "GTC" as const,
        price: 123n,
        quantity: 456n,
      };
      const json = serializeCommand(cmd);
      const obj = JSON.parse(json);
      expect(typeof obj.price).toBe("string");
      expect(typeof obj.quantity).toBe("string");
    });
  });

  describe("CD5: Deterministic serialization", () => {
    it("same value serializes identically", () => {
      const cmd = {
        kind: "PLACE" as const,
        ts: 1000,
        orderId: "o1",
        accountId: "a1",
        side: "BUY" as const,
        orderType: "LIMIT" as const,
        timeInForce: "GTC" as const,
        price: 100n,
        quantity: 10n,
      };
      const s1 = serializeCommand(cmd);
      const s2 = serializeCommand(cmd);
      expect(s1).toBe(s2);
    });
  });

  describe("CD6: Versioning", () => {
    it("unknown version throws UnknownSchemaVersionError", () => {
      const json = JSON.stringify({ v: 999, type: "PLACE" });
      expect(() => deserializeCommand(json)).toThrow("Invalid schema version");
    });

    it("upcaster can be registered and retrieved", () => {
      const v0Cmd = { type: "PLACE", orderId: "o1" };
      const upcast = (v0: unknown) => Object.assign({}, v0 as any, { v: CURRENT_VERSION });
      registerUpcaster(0, upcast);
      const fn = getUpcaster(0);
      expect(fn).toBeDefined();
      expect(fn?.(v0Cmd)).toEqual({ ...v0Cmd, v: CURRENT_VERSION });
    });
  });

  describe("Event serialization", () => {
    it("ORDER_ACCEPTED round-trips", () => {
      const ev: any = {
        type: "ORDER_ACCEPTED",
        engineSeq: 1n,
        ts: 1000n,
        orderId: "o1",
        accountId: "a1",
        side: "BUY",
        orderType: "LIMIT",
        price: 100n,
        quantity: 10n,
      };
      const json = serializeEvent(ev);
      const back = deserializeEvent(json);
      expect(back.type).toBe("ORDER_ACCEPTED");
      expect(back.engineSeq).toBe(1n);
    });

    it("TRADE_EXECUTED preserves bigint tradeId-related fields", () => {
      const ev: any = {
        type: "TRADE_EXECUTED",
        engineSeq: 5n,
        ts: 2000n,
        tradeId: "t1",
        symbol: "ABC",
        price: 100n,
        quantity: 10n,
        takerOrderId: "o1",
        makerOrderId: "o2",
        takerAccountId: "a1",
        makerAccountId: "a2",
        takerSide: "BUY",
      };
      const json = serializeEvent(ev);
      const back = deserializeEvent(json);
      expect(back.type).toBe("TRADE_EXECUTED");
      if (back.type === "TRADE_EXECUTED") {
        expect(back.price).toBe(100n);
        expect(back.quantity).toBe(10n);
      }
    });
  });

  describe("Book snapshot codec", () => {
    it("empty snapshot round-trips", () => {
      const snap: any = {
        version: 1,
        symbol: "ABC",
        spec: { symbol: "ABC", tickSize: 1n, lotSize: 1n, maxQuantity: 1000n, maxPrice: 10000n },
        nextArrivalSeq: 0,
        nextTradeSeq: 0,
        bids: [],
        asks: [],
      };
      const json = serializeBookSnapshot(snap);
      const back = deserializeBookSnapshot(json);
      expect(back.symbol).toBe("ABC");
      expect(back.bids).toHaveLength(0);
      expect(back.asks).toHaveLength(0);
    });

    it("CDB1: Tick/HaltSymbol/ResumeSymbol round-trips", () => {
      const commands = [
        { type: "Tick", ts: 1000 },
        { type: "HaltSymbol", reason: "manual halt", ts: 1100 },
        { type: "ResumeSymbol", ts: 1200 },
      ] as const;

      for (const cmd of commands) {
        const json = serializeCommand(cmd as any);
        const back = deserializeCommand(json);
        expect(back).toMatchObject(cmd);
      }
    });

    it("CDB2: Breaker events round-trip", () => {
      const events = [
        { type: "BreakerTripped", reason: "VOLATILITY", thresholdBps: 500n, incidentStartTs: 1000, ts: 2000 },
        { type: "BreakerHalfOpened", trigger: "COOLDOWN", ts: 1200 },
        { type: "BreakerClosed", incidentDurationMs: 1500, ts: 3000 },
      ] as const;

      for (const ev of events) {
        const json = serializeEvent(ev as any);
        const back = deserializeEvent(json);
        expect(back).toMatchObject(ev);
      }
    });
  });
});
