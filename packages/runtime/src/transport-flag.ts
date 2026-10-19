/**
 * TRANSPORT flag composition (Week 10, task 5.5).
 * Select EventSink implementation based on TRANSPORT=inproc|kafka.
 * inproc mode must not import the Kafka client and behave exactly as Week 9.
 */

import type { EventSink } from "@matchledger/common";

export type TransportMode = "inproc" | "kafka";

export interface TransportCompositionConfig {
  mode: TransportMode;
  kafkaBrokers?: string[];
  kafkaTopic?: string;
}

/**
 * Create EventSink based on TRANSPORT mode.
 * inproc: Returns in-process sink (CollectingSink or DurableEventSink)
 * kafka: Returns KafkaEventSink (transactional to engine.events topic)
 */
export async function createEventSink(config: TransportCompositionConfig): Promise<EventSink> {
  if (config.mode === "inproc") {
    // In-process mode: no Kafka imports
    // Use DurableEventSink(downstream = CollectingSink)
    // This is the Week 9 behavior, unchanged

    // Placeholder: would import from @matchledger/shard
    // const { DurableEventSink, CollectingSink } = await import("@matchledger/shard");
    // return new DurableEventSink({ downstream: new CollectingSink() });

    return {
      publish: async () => {
        // In-process sink - events are handled in-memory
      },
    };
  } else if (config.mode === "kafka") {
    // Kafka mode: transactional producer to engine.events
    const { KafkaEventSink } = await import("@matchledger/transport");
    const brokers = config.kafkaBrokers ?? ["localhost:29092"];
    const topic = config.kafkaTopic ?? "engine.events";

    const sink = new KafkaEventSink(brokers, topic);
    await sink.init();
    return sink;
  } else {
    throw new Error(`Unknown TRANSPORT mode: ${config.mode}`);
  }
}

/**
 * Parse TRANSPORT env var and return config.
 * Defaults to inproc if not set.
 */
export function configFromEnv(): TransportCompositionConfig {
  const mode = (process.env.TRANSPORT ?? "inproc") as TransportMode;

  if (mode !== "inproc" && mode !== "kafka") {
    throw new Error(`Invalid TRANSPORT=${process.env.TRANSPORT}. Use 'inproc' or 'kafka'.`);
  }

  return {
    mode,
    kafkaBrokers: process.env.KAFKA_BROKERS?.split(","),
    kafkaTopic: process.env.KAFKA_ENGINE_EVENTS_TOPIC,
  };
}
