import { KafkaJS } from "@confluentinc/kafka-javascript";
import type { EventSink, ShardOutput } from "@matchledger/common";

// Week 10: Kafka transport for shard output. Publishes batches to engine.events topic.
export class KafkaEventSink implements EventSink {
  private producer: ReturnType<ReturnType<typeof KafkaJS.Kafka>["producer"]>;

  constructor(brokers: string[], topicName = "engine.events") {
    const { Kafka } = KafkaJS;
    const kafka = new Kafka({ kafkaJS: { brokers } });
    this.producer = kafka.producer({
      "transactional.id": `shard-${process.env.SHARD_ID ?? "unknown"}`,
      "enable.idempotence": true,
      kafkaJS: { acks: -1 }, // wait for all replicas
    });
    this.topicName = topicName;
  }

  private topicName: string;

  async publish(batch: readonly ShardOutput[]): Promise<void> {
    if (batch.length === 0) return;

    await this.producer.send({
      topic: this.topicName,
      messages: batch.map((event) => ({
        key: event.symbol,
        value: JSON.stringify(event),
        partition: Math.abs(event.symbol.charCodeAt(0) % 4), // 4 partitions in Week 10 topics
      })),
    });
  }
}
