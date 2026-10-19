import { TransactionalProducer } from "./producer.js";
import { encodeEnvelope } from "./envelope.js";
import type { EventSink, ShardOutput } from "@matchledger/common";

export class KafkaEventSink implements EventSink {
  private producer: TransactionalProducer;
  private initialized = false;

  constructor(brokers: string[], topicName = "engine.events") {
    const shardId = process.env.SHARD_ID ?? "unknown";
    this.producer = new TransactionalProducer({
      brokers,
      transactionalId: `shard-${shardId}`,
      acks: -1,
    });
    this.topicName = topicName;
  }

  private topicName: string;

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.producer.init();
    this.initialized = true;
  }

  async publish(batch: readonly ShardOutput[]): Promise<void> {
    if (batch.length === 0) return;

    if (!this.initialized) {
      throw new Error("KafkaEventSink not initialized; call init() first");
    }

    const messages = batch.map((event) => ({
      key: event.symbol,
      value: encodeEnvelope({
        schemaVersion: 1,
        msgId: `${event.symbol}:${event.seq}`,
        type: "ShardOutput",
        payload: event,
      }),
      partition: Math.abs(event.symbol.charCodeAt(0) % 4), // 4 partitions per docker-compose.yml
    }));

    await this.producer.sendBatch(this.topicName, messages);
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    this.initialized = false;
  }
}
