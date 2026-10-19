import type { EventSink } from "@matchledger/common";
import { KafkaEventSink } from "./kafka-event-sink.js";

export interface TransportConfig {
  mode: "inproc" | "kafka";
  kafkaBrokers?: string[];
  kafkaTopic?: string;
}

// Week 10 transport factory: select EventSink implementation based on TRANSPORT flag.
// - TRANSPORT=inproc: Use in-process sinks (CollectingSink, DurableEventSink from @matchledger/shard)
// - TRANSPORT=kafka: Use Kafka transport (KafkaEventSink from @matchledger/transport)
export function createEventSink(config: TransportConfig): EventSink {
  if (config.mode === "kafka") {
    const brokers = config.kafkaBrokers ?? [process.env.KAFKA_BOOTSTRAP_SERVERS ?? "localhost:29092"];
    const topic = config.kafkaTopic ?? "engine.events";
    return new KafkaEventSink(brokers, topic);
  }

  throw new Error(`Unsupported transport mode: ${config.mode}. Use 'inproc' or 'kafka'.`);
}

// Parse TRANSPORT env var to TransportConfig
export function configFromEnv(): TransportConfig {
  const transport = process.env.TRANSPORT ?? "inproc";
  const kafkaBrokers = process.env.KAFKA_BOOTSTRAP_SERVERS?.split(",");
  const kafkaTopic = process.env.KAFKA_ENGINE_EVENTS_TOPIC ?? "engine.events";

  if (transport === "kafka") {
    return { mode: "kafka", kafkaBrokers, kafkaTopic };
  }
  if (transport === "inproc") {
    return { mode: "inproc" };
  }

  throw new Error(`Unknown TRANSPORT=${transport}. Supported: 'inproc', 'kafka'.`);
}
