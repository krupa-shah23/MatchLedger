import { describe, expect, it } from "vitest";
import { partitionOf } from "@matchledger/common";
import type { InstrumentSpec } from "@matchledger/engine-core";
import { buildSeededLoadRecords, runKafkaLoad, type KafkaMessageProducer } from "./kafka-producer.js";

const instrument: InstrumentSpec = {
  symbol: "ACME",
  tickSize: 5n,
  lotSize: 10n,
  maxQuantity: 100_000n,
  maxPrice: 50_000n,
};

describe("LG3: seeded Kafka load generation", () => {
  it("repeats identical Phase B message sequences for the same seed and changes them for a different seed", () => {
    const config = {
      seed: 42,
      ticks: 25,
      accounts: ["load-1", "load-2"],
      instruments: [instrument],
      phaseB: true,
      riskPartitions: 4,
      shardPartitions: 4,
    };
    const first = buildSeededLoadRecords(config);
    const same = buildSeededLoadRecords(config);
    const other = buildSeededLoadRecords({ ...config, seed: 43 });

    expect(first).toEqual(same);
    expect(first).not.toEqual(other);
    expect(first.length).toBeGreaterThan(0);
    for (const record of first) {
      expect(record.topic).toBe("orders.submitted");
      expect(record.partition).toBe(partitionOf(record.accountId, 4));
      const envelope = JSON.parse(record.value) as { schemaVersion: number; type: string; payload: { quantity: string; accountId: string } };
      expect(envelope.schemaVersion).toBe(1);
      expect(envelope.type).toBe("SubmitOrder");
      expect(BigInt(envelope.payload.quantity)).toBeGreaterThan(0n);
      expect(envelope.payload.accountId).toBe(record.accountId);
    }
  });

  it("uses orders.accepted with matching command envelopes and labels risk bypass", () => {
    const records = buildSeededLoadRecords({
      seed: 17,
      ticks: 40,
      accounts: ["load-1"],
      instruments: [instrument],
      phaseB: false,
      riskPartitions: 4,
      shardPartitions: 4,
    });
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.topic).toBe("orders.accepted");
      expect(record.partition).toBe(partitionOf(instrument.symbol, 4));
      const envelope = JSON.parse(record.value) as { type: string; payload: { kind: string; symbol: string; price: string } };
      expect(envelope.type).toBe("MatchingCommand");
      expect(envelope.payload.kind).toBe("PLACE");
      expect(envelope.payload.symbol).toBe(instrument.symbol);
      expect(BigInt(envelope.payload.price)).toBeGreaterThan(0n);
    }
  });

  it("runs configured rate steps and records actual injected send times", async () => {
    let clock = 0;
    const sentTopics: string[] = [];
    const route: Array<{ topic: string; shardOnly: boolean }> = [];
    const producer: KafkaMessageProducer = {
      connect: async () => {},
      send: async ({ topic }) => { sentTopics.push(topic); },
      disconnect: async () => {},
    };
    const sent = await runKafkaLoad({
      seed: 24,
      ticks: 40,
      accounts: ["load-1"],
      instruments: [instrument],
      phaseB: true,
      riskPartitions: 4,
      shardPartitions: 4,
      brokers: ["broker:9092"],
      steps: [{ durationMs: 1_000, ordersPerSecond: 2 }],
      producerFactory: () => producer,
      now: () => clock,
      sleep: async (milliseconds) => { clock += milliseconds; },
      onRoute: (topic, shardOnly) => route.push({ topic, shardOnly }),
    });

    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((record) => record.sentAtMs < 1_000)).toBe(true);
    expect(sent.map((record) => record.sentAtMs)).toEqual([...sent.map((record) => record.sentAtMs)].sort((a, b) => a - b));
    expect(sentTopics).toEqual(sent.map((record) => record.topic));
    expect(route).toEqual([{ topic: "orders.submitted", shardOnly: false }]);
  });
});
