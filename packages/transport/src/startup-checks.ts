import { KafkaJS } from "@confluentinc/kafka-javascript";

const { Kafka } = KafkaJS;

export interface TopicConfig {
  name: string;
  partitions: number;
}

/**
 * Startup checks: verify that all topics exist and have the correct partition counts.
 * Fails fast with a readable list of errors if any topic is missing or mismatched.
 */
export async function checkTopics(brokers: string[], topics: readonly TopicConfig[]): Promise<void> {
  const kafka = new Kafka({ kafkaJS: { brokers } });
  const admin = kafka.admin();

  try {
    await admin.connect();

    const metadata = await admin.fetchTopicMetadata() as any;
    const existingTopics = new Map(
      (metadata.topics || []).map((t: any) => [t.name, t.partitions.length])
    );

    const errors: string[] = [];

    for (const config of topics) {
      if (!existingTopics.has(config.name)) {
        errors.push(`Topic "${config.name}" does not exist`);
      } else {
        const actual = existingTopics.get(config.name)!;
        if (actual !== config.partitions) {
          errors.push(
            `Topic "${config.name}" has ${actual} partitions, expected ${config.partitions}`
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Topic startup checks failed:\n  - ${errors.join("\n  - ")}`);
    }
  } finally {
    await admin.disconnect();
  }
}
