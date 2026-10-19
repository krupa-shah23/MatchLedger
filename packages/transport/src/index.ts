export { KafkaEventSink } from "./kafka-event-sink.js";
export type { TransportConfig } from "./transport-factory.js";
export { createEventSink } from "./transport-factory.js";
export { encodeEnvelope, decodeEnvelope, createDeadLetterMessage } from "./envelope.js";
export type { Envelope, DeadLetterEntry } from "./envelope.js";
export { TransactionalProducer, FencedProducerError } from "./producer.js";
export type { TransactionalProducerConfig, Message } from "./producer.js";
export { PartitionConsumer } from "./consumer.js";
export type { PartitionConsumerConfig, ConsumerMessage } from "./consumer.js";
export { checkTopics } from "./startup-checks.js";
export type { TopicConfig } from "./startup-checks.js";

