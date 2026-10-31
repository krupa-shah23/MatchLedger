import { KafkaJS } from "@confluentinc/kafka-javascript";

const { Kafka } = KafkaJS;

export interface PartitionConsumerConfig {
  brokers: string[];
  groupId: string;
  groupInstanceId: string;
  sessionTimeoutMs?: number;
  maxPollIntervalMs?: number;
  fromBeginning?: boolean;
  onAssignmentLost?: () => void;
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
  private consumer: KafkaJS.Consumer | null = null;
  private kafka: KafkaJS.Kafka | null = null;
  private running = false;

  constructor(private config: PartitionConsumerConfig) {}

  async init(): Promise<void> {
    this.kafka = new Kafka({
      kafkaJS: { brokers: this.config.brokers },
    });

    this.consumer = this.kafka.consumer({
      "group.protocol": "classic",
      rebalance_cb: (_error: unknown, _assignment: unknown, callbacks: { assignmentLost(): boolean }) => {
        if (callbacks.assignmentLost()) this.config.onAssignmentLost?.();
      },
      "enable.auto.commit": false,
      "isolation.level": "read_committed",
      "group.instance.id": this.config.groupInstanceId,
      "session.timeout.ms": this.config.sessionTimeoutMs ?? 10000,
      "max.poll.interval.ms": this.config.maxPollIntervalMs ?? 300000,
      kafkaJS: {
        groupId: this.config.groupId,
        autoCommit: false,
        fromBeginning: this.config.fromBeginning ?? false,
      },
    });

    await this.consumer.connect();
  }

  async assign(topic: string): Promise<void> {
    if (!this.consumer) {
      throw new Error("Consumer not initialized");
    }

    // fromBeginning is set at consumer construction time (kafkaJS.fromBeginning)
    await this.consumer.subscribe({ topic });
  }

  async seek(topic: string, partition: number, offset: bigint): Promise<void> {
    if (!this.consumer) {
      throw new Error("Consumer not initialized");
    }

    // KafkaJS seek API expects offset as a string
    this.consumer.seek({ topic, partition, offset: offset.toString() });
  }

  async pause(partitions: Array<{ topic: string; partition: number }>): Promise<void> {
    if (!this.consumer) {
      throw new Error("Consumer not initialized");
    }

    this.consumer.pause(groupPartitionsByTopic(partitions));
  }

  async resume(partitions: Array<{ topic: string; partition: number }>): Promise<void> {
    if (!this.consumer) {
      throw new Error("Consumer not initialized");
    }

    this.consumer.resume(groupPartitionsByTopic(partitions));
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
        eachMessage: async (payload: KafkaJS.EachMessagePayload) => {
          const { topic, partition, message } = payload;
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

  assignments(): Array<{ topic: string; partition: number }> {
    return this.consumer?.assignment() ?? [];
  }
}

function groupPartitionsByTopic(
  partitions: Array<{ topic: string; partition: number }>
): Array<{ topic: string; partitions: number[] }> {
  const byTopic = new Map<string, number[]>();
  for (const { topic, partition } of partitions) {
    const existing = byTopic.get(topic);
    if (existing) {
      existing.push(partition);
    } else {
      byTopic.set(topic, [partition]);
    }
  }
  return Array.from(byTopic, ([topic, topicPartitions]) => ({ topic, partitions: topicPartitions }));
}
