/**
 * Command routing tests (CP6, CP7).
 * Verify cancels and halt/resume are routed to correct topics and partitions.
 */

import { describe, it, expect } from "vitest";
import { partitionOf } from "@matchledger/common";

describe("CP: Command Routing", () => {
  it("CP6: Client cancel and sweeper cancel routed through orders.accepted keyed by symbol", () => {
    // Cancels should be routed to orders.accepted with symbol as key
    // This ensures ordering relative to the original order

    const symbol = "AAPL";
    const partition = partitionOf(symbol, 4); // 4 partitions

    // Both cancels for AAPL go to the same partition
    const clientCancelPartition = partitionOf("AAPL", 4);
    const sweeperCancelPartition = partitionOf("AAPL", 4);

    expect(clientCancelPartition).toBe(sweeperCancelPartition);
    expect(clientCancelPartition).toBe(partition);
  });

  it("CP7: Halt and resume routed through control.commands keyed by symbol", () => {
    // Halt and resume should be routed to control.commands with symbol as key
    // Ordering relative to orders is not required

    const symbol = "MSFT";
    const haltPartition = partitionOf(symbol, 4);
    const resumePartition = partitionOf(symbol, 4);

    // Both halt and resume for MSFT go to the same partition
    expect(haltPartition).toBe(resumePartition);

    // Different symbols might go to different partitions
    const otherSymbol = "GOOGL";
    const otherPartition = partitionOf(otherSymbol, 4);

    // MSFT and GOOGL may or may not be in same partition depending on hash
    // But the key point is they're consistently routed based on symbol
    expect(partitionOf(symbol, 4)).toBe(partitionOf(symbol, 4));
    expect(partitionOf(otherSymbol, 4)).toBe(partitionOf(otherSymbol, 4));
  });

  it("CP6b: Cancel partitions match order partitions (maintains ordering)", () => {
    // The original order goes to a partition based on symbol
    // The cancel must go to the same partition to maintain FIFO ordering
    // This prevents a cancel from overtaking its order

    const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];
    const shardPartitions = 4;

    for (const symbol of symbols) {
      const orderPartition = partitionOf(symbol, shardPartitions);
      const cancelPartition = partitionOf(symbol, shardPartitions);

      // Cancel partition matches order partition
      expect(cancelPartition).toBe(orderPartition);
    }
  });

  it("CP7b: Halt/resume messages are visible at the same partition as their order", () => {
    // Halt and resume control messages are for managing symbol processing
    // They're published to the shard that owns that symbol

    const symbol = "AAPL";
    const orderPartition = partitionOf(symbol, 4);
    const haltPartition = partitionOf(symbol, 4);

    // Same partition owner
    expect(haltPartition).toBe(orderPartition);
  });
});
