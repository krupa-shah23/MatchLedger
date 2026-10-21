import { KafkaJS } from "@confluentinc/kafka-javascript";

const { Kafka } = KafkaJS;

export class FencedProducerError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "FencedProducerError";
  }
}

export interface TransactionalProducerConfig {
  brokers: string[];
  transactionalId: string;
  acks?: -1 | 0 | 1;
}

export interface Message {
  key: string;
  value: string;
  partition?: number;
}

/**
 * Transactional producer wrapper (Kafka client names per docs/spike-4.md)
 * Wraps @confluentinc/kafka-javascript producer with init, send to explicit partition,
 * commit, abort, and fenced-error detection.
 */
type KafkaProducer = any;
type KafkaInstance = any;

export class TransactionalProducer {
  private producer: KafkaProducer | null = null;
  private kafka: KafkaInstance | null = null;

  constructor(private config: TransactionalProducerConfig) {}

  async init(): Promise<void> {
    this.kafka = new (Kafka as any)({
      kafkaJS: { brokers: this.config.brokers },
    });

    this.producer = (this.kafka as any).producer({
      "transactional.id": this.config.transactionalId,
      "enable.idempotence": true,
      kafkaJS: { acks: this.config.acks ?? -1 },
    });

    await (this.producer as any).connect();
  }

  async sendBatch(topic: string, messages: readonly Message[]): Promise<void> {
    if (!this.producer) {
      throw new Error("Producer not initialized");
    }

    const tx = await (this.producer as any).transaction();
    try {
      await tx.send({
        topic,
        messages: messages.map((m) => ({
          key: m.key,
          value: m.value,
          partition: m.partition,
        })),
      });
      await tx.commit();
    } catch (error) {
      await tx.abort();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
    }
  }

  /**
   * Check if this producer has been fenced by a newer instance with the same transactional.id.
   * Per Spike 4, fencing is detected by attempting a write and catching the error.
   */
  async checkFenced(): Promise<boolean> {
    if (!this.producer) {
      throw new Error("Producer not initialized");
    }

    try {
      const tx = await this.producer.transaction();
      await tx.send({
        topic: "orders.accepted",
        messages: [{ key: "test", value: "test", partition: 0 }],
      });
      await tx.abort();
      return false;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const type = (error as { type?: string }).type;
      if (
        msg.includes("fenced") ||
        msg.includes("old epoch") ||
        msg.includes("FENCED") ||
        // librdkafka purges the producer's internal queue as a side effect of
        // the fatal _FENCED error raised when a newer producer instance with
        // the same transactional.id has taken over.
        type === "ERR__PURGE_QUEUE"
      ) {
        return true;
      }
      throw error;
    }
  }
}
