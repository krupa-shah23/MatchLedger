/** Kafka load generation. The Kafka client is deliberately confined to this load module. */

import { KafkaJS } from "@confluentinc/kafka-javascript";
import { partitionOf } from "@matchledger/common";
import type { InstrumentSpec } from "@matchledger/engine-core";
import { createFlowModel, flowModelNextTick, type GeneratedOrder, type Scenario } from "../flow-model.js";
import { mulberry32 } from "../prng.js";

export type LoadTopic = "orders.submitted" | "orders.accepted";

export interface LoadRateStep {
  durationMs: number;
  ordersPerSecond: number;
}

export interface SeededLoadConfig {
  seed: number;
  ticks: number;
  accounts: readonly string[];
  instruments: readonly InstrumentSpec[];
  scenario?: Scenario;
  phaseB: boolean;
  riskPartitions: number;
  shardPartitions: number;
}

export interface LoadRecord {
  topic: LoadTopic;
  key: string;
  partition: number;
  value: string;
  orderId: string;
  accountId: string;
}

export interface SentLoadRecord extends LoadRecord {
  sentAtMs: number;
}

export interface KafkaMessageProducer {
  connect(): Promise<void>;
  send(input: { topic: string; messages: Array<{ key: string; value: string; partition: number }> }): Promise<unknown>;
  disconnect(): Promise<void>;
}

export interface KafkaLoadRunConfig extends SeededLoadConfig {
  brokers: string[];
  steps: readonly LoadRateStep[];
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  producerFactory?: (brokers: string[]) => KafkaMessageProducer;
  onRoute?: (topic: LoadTopic, shardOnly: boolean) => void;
  log?: (message: string) => void;
}

function encodeEnvelope(envelope: unknown): string {
  return JSON.stringify(envelope, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value);
}

function makeRecord(config: SeededLoadConfig, order: GeneratedOrder, tick: number, accountId: string): LoadRecord {
  const orderId = `load:${config.seed}:${order.symbol}:${tick}:${order.clientOrderId}`;
  if (config.phaseB) {
    const payload = {
      type: "SubmitOrder",
      orderId,
      accountId,
      clientOrderId: orderId,
      symbol: order.symbol,
      side: order.side,
      kind: order.type,
      timeInForce: order.type === "MARKET" ? "IOC" : "GTC",
      quantity: order.quantity,
      ...(order.price === null ? {} : { price: order.price }),
      market: {},
    };
    return {
      topic: "orders.submitted",
      key: accountId,
      partition: partitionOf(accountId, config.riskPartitions),
      value: encodeEnvelope({ schemaVersion: 1, msgId: orderId, type: "SubmitOrder", payload }),
      orderId,
      accountId,
    };
  }

  // Shard-only mode bypasses risk and publishes the existing MatchingCommand envelope.
  // The model's market orders cannot be represented as priced engine IOC commands, so
  // those are filtered by buildSeededLoadRecords below.
  const spec = config.instruments.find((instrument) => instrument.symbol === order.symbol)!;
  const price = order.price ?? (order.side === "BUY" ? spec.maxPrice : spec.tickSize);
  const payload = {
    kind: "PLACE",
    ts: 0n,
    orderId,
    accountId,
    side: order.side,
    orderType: order.type === "MARKET" ? "IOC" : "LIMIT",
    timeInForce: order.type === "MARKET" ? "IOC" : "GTC",
    price,
    quantity: order.quantity,
  };
  return {
    topic: "orders.accepted",
    key: order.symbol,
    partition: partitionOf(order.symbol, config.shardPartitions),
    value: encodeEnvelope({ schemaVersion: 1, msgId: orderId, type: "MatchingCommand", payload: { ...payload, symbol: order.symbol } }),
    orderId,
    accountId,
  };
}

/** Build the same immutable message sequence for a seed and configuration. */
export function buildSeededLoadRecords(config: SeededLoadConfig): LoadRecord[] {
  if (!Number.isInteger(config.seed)) throw new Error("seed must be an integer");
  if (!Number.isInteger(config.ticks) || config.ticks < 1) throw new Error("ticks must be a positive integer");
  if (!config.accounts.length) throw new Error("at least one funded account is required");
  if (!config.instruments.length) throw new Error("at least one instrument is required");
  if (!Number.isInteger(config.riskPartitions) || config.riskPartitions < 1 || !Number.isInteger(config.shardPartitions) || config.shardPartitions < 1) {
    throw new Error("partition counts must be positive integers");
  }
  const accountRng = mulberry32(config.seed ^ 0x51ed270b);
  const records: LoadRecord[] = [];
  for (const [instrumentIndex, instrument] of config.instruments.entries()) {
    const model = createFlowModel(config.seed + instrumentIndex, instrument, config.scenario ?? "steady");
    let state = model;
    let counter = 0;
    for (let tick = 0; tick < config.ticks; tick++) {
      const generated = flowModelNextTick(state, tick, counter);
      state = generated.newState;
      counter = generated.nextCounter;
      for (const order of generated.orders) {
        if (order.quantity <= 0n || (!config.phaseB && order.type === "MARKET")) continue;
        const accountId = config.accounts[Math.floor(accountRng() * config.accounts.length)]!;
        records.push(makeRecord(config, order, tick, accountId));
      }
    }
  }
  return records;
}

export function createKafkaLoadProducer(brokers: string[]): KafkaMessageProducer {
  if (brokers.length === 0 || brokers.some((broker) => broker.trim() === "")) throw new Error("Kafka broker list is required");
  const kafka = new KafkaJS.Kafka({ kafkaJS: { brokers } });
  return kafka.producer({ "enable.idempotence": true, acks: -1, kafkaJS: { acks: -1 } });
}

/**
 * Send a deterministic sequence with an open rate schedule and record each send
 * timestamp. The injected clock and sleeper let tests verify scheduling without
 * real delays.
 */
export async function runKafkaLoad(config: KafkaLoadRunConfig): Promise<SentLoadRecord[]> {
  if (config.brokers.length === 0) throw new Error("Kafka broker list is required");
  if (config.steps.length === 0 || config.steps.some((step) => step.durationMs < 1 || step.ordersPerSecond <= 0 || !Number.isFinite(step.ordersPerSecond))) {
    throw new Error("rate steps require positive durations and rates");
  }
  const topic: LoadTopic = config.phaseB ? "orders.submitted" : "orders.accepted";
  (config.log ?? console.log)(config.phaseB
    ? `Kafka load target: ${topic} (risk path included)`
    : `Kafka load target: ${topic} (shard-only; risk bypassed)`);
  config.onRoute?.(topic, !config.phaseB);
  const estimate = config.steps.reduce((total, step) => total + Math.ceil(step.durationMs * step.ordersPerSecond / 1000), 0);
  const records = buildSeededLoadRecords({ ...config, ticks: Math.max(config.ticks, estimate * 4 + 100) });
  const producer = (config.producerFactory ?? createKafkaLoadProducer)(config.brokers);
  const now = config.now ?? Date.now;
  const sleep = config.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const sent: SentLoadRecord[] = [];
  let cursor = 0;
  await producer.connect();
  try {
    for (const step of config.steps) {
      const startedAt = now();
      let stepSent = 0;
      while (now() - startedAt < step.durationMs) {
        const dueAt = startedAt + stepSent * (1000 / step.ordersPerSecond);
        const delay = dueAt - now();
        if (delay > 0) await sleep(delay);
        if (now() - startedAt >= step.durationMs) break;
        const record = records[cursor++];
        if (!record) throw new Error("seeded flow generated too few order records for the configured rate steps");
        const sentAtMs = now();
        await producer.send({ topic: record.topic, messages: [{ key: record.key, value: record.value, partition: record.partition }] });
        sent.push({ ...record, sentAtMs });
        stepSent++;
      }
    }
  } finally {
    await producer.disconnect();
  }
  return sent;
}
