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
type KafkaProducer = unknown;
type KafkaInstance = unknown;

export class TransactionalProducer {
  private producer: KafkaProducer | null = null;
  private kafka: KafkaInstance | null = null;

  constructor(private config: TransactionalProducerConfig) {}

  async init(): Promise<void> {
    this.kafka = new Kafka({
      kafkaJS: { brokers: this.config.brokers },
    });

    this.producer = this.kafka.producer({
      "transactional.id": this.config.transactionalId,
      "enable.idempotence": true,
      kafkaJS: { acks: this.config.acks ?? -1 },
    });

    await this.producer.connect();
  }

  async sendBatch(topic: string, messages: readonly Message[]): Promise<void> {
    if (!this.producer) {
      throw new Error("Producer not initialized");
    }

    const tx = await this.producer.transaction();
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
        topic: "__test__",
        messages: [{ key: "test", value: "test" }],
      });
      await tx.abort();
      return false;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes("fenced") ||
        msg.includes("old epoch") ||
        msg.includes("FENCED")
      ) {
        return true;
      }
      throw error;
    }
  }
}
