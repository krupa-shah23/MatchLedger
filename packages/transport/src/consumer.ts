import { KafkaJS } from "@confluentinc/kafka-javascript";

const { Kafka } = KafkaJS;

export interface PartitionConsumerConfig {
  brokers: string[];
  groupId: string;
  groupInstanceId: string;
}

export interface ConsumerMessage {
  topic: string;
  partition: number;
  offset: bigint;
  key: string | null;
  value: Buffer;
}

/**
 * Partition consumer wrapper (Kafka client names per docs/spike-4.md)
 * Wraps @confluentinc/kafka-javascript consumer with assign, seek, pause, resume, callbacks.
 */
export class PartitionConsumer {
  private consumer: ReturnType<ReturnType<typeof KafkaJS.Kafka>["consumer"]> | null = null;
  private kafka: ReturnType<typeof KafkaJS.Kafka> | null = null;
  private running = false;

  constructor(private config: PartitionConsumerConfig) {}

  async init(): Promise<void> {
    this.kafka = new Kafka({
      kafkaJS: { brokers: this.config.brokers },
    });

    this.consumer = this.kafka.consumer({
      "group.protocol": "classic",
      "enable.auto.commit": false,
      "isolation.level": "read_committed",
      kafkaJS: {
        groupId: this.config.groupId,
        groupInstanceId: this.config.groupInstanceId,
        autoCommit: false,
        fromBeginning: false,
      },
    });

    await this.consumer.connect();
  }

  async assign(topic: string, partition: number): Promise<void> {
    if (!this.consumer) {
      throw new Error("Consumer not initialized");
    }

    await this.consumer.subscribe({ topic, fromBeginning: false });
  }

  async seek(topic: string, partition: number, offset: bigint): Promise<void> {
    if (!this.consumer) {
      throw new Error("Consumer not initialized");
    }

    // KafkaJS seek API expects offset as a string
    await this.consumer.seek({ topic, partition, offset: offset.toString() });
  }

  async pause(partitions: Array<{ topic: string; partition: number }>): Promise<void> {
    if (!this.consumer) {
      throw new Error("Consumer not initialized");
    }

    await this.consumer.pause(partitions);
  }

  async resume(partitions: Array<{ topic: string; partition: number }>): Promise<void> {
    if (!this.consumer) {
      throw new Error("Consumer not initialized");
    }

    await this.consumer.resume(partitions);
  }

  async run(
    onMessage: (msg: ConsumerMessage) => Promise<void>,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (!this.consumer) {
      throw new Error("Consumer not initialized");
    }

    this.running = true;

    try {
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const msg: ConsumerMessage = {
            topic,
            partition,
            offset: BigInt(message.offset),
            key: message.key ? message.key.toString() : null,
            value: message.value as Buffer,
          };

          try {
            await onMessage(msg);
          } catch (error) {
            if (onError) {
              onError(error instanceof Error ? error : new Error(String(error)));
            } else {
              throw error;
            }
          }
        },
      });
    } finally {
      this.running = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}
