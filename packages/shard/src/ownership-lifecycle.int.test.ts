import { describe, it, expect } from "vitest";
import { OffsetTickets } from "./offset-tickets.js";

describe("OW: Ownership Lifecycle", () => {
  describe("OffsetTickets", () => {
    it("OW7: One ticket per non-Tick command, mismatch throws", () => {
      const tickets = new OffsetTickets();

      // Push 3 tickets (3 consumed messages from Kafka)
      tickets.push({ topic: "orders.accepted", partition: 0, offset: 100n });
      tickets.push({ topic: "orders.accepted", partition: 0, offset: 101n });
      tickets.push({ topic: "orders.accepted", partition: 0, offset: 102n });

      expect(tickets.size()).toBe(3);

      // Pop for 3 commands (matches tickets)
      const batch = tickets.popBatch(3);
      expect(batch).toHaveLength(3);
      expect(batch[0].offset).toBe(100n);
      expect(batch[1].offset).toBe(101n);
      expect(batch[2].offset).toBe(102n);

      expect(tickets.size()).toBe(0);
    });

    it("OW7b: Mismatch between command count and ticket count throws", () => {
      const tickets = new OffsetTickets();

      tickets.push({ topic: "orders.accepted", partition: 0, offset: 100n });
      tickets.push({ topic: "orders.accepted", partition: 0, offset: 101n });

      // Try to pop 3 commands but only 2 tickets exist
      expect(() => tickets.popBatch(3)).toThrow("mismatch: need 3 offsets, have 2");
    });

    it("OW7c: Clear tickets between batches", () => {
      const tickets = new OffsetTickets();

      tickets.push({ topic: "orders.accepted", partition: 0, offset: 100n });
      tickets.popBatch(1);

      expect(tickets.size()).toBe(0);

      tickets.push({ topic: "orders.accepted", partition: 0, offset: 101n });
      expect(tickets.size()).toBe(1);

      tickets.clear();
      expect(tickets.size()).toBe(0);
    });

    it("OW7d: FIFO order is preserved", () => {
      const tickets = new OffsetTickets();

      tickets.push({ topic: "orders.accepted", partition: 0, offset: 10n });
      tickets.push({ topic: "orders.accepted", partition: 1, offset: 20n });
      tickets.push({ topic: "orders.accepted", partition: 0, offset: 30n });

      const batch = tickets.popBatch(3);

      expect(batch[0]).toEqual({ topic: "orders.accepted", partition: 0, offset: 10n });
      expect(batch[1]).toEqual({ topic: "orders.accepted", partition: 1, offset: 20n });
      expect(batch[2]).toEqual({ topic: "orders.accepted", partition: 0, offset: 30n });
    });
  });
});
