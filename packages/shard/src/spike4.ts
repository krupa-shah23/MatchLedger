import { KafkaJS } from "@confluentinc/kafka-javascript";
const { Kafka, ErrorCodes } = KafkaJS;
const brokers = [process.env.KAFKA_BROKER ?? "localhost:29092"];
const kafka = new Kafka({ kafkaJS: { brokers } });
const transactionalId = "matchledger-spike4";
const producer = kafka.producer({ "transactional.id": transactionalId, "enable.idempotence": true, acks: -1 });
const consumer = kafka.consumer({ "group.protocol": "classic", "enable.auto.commit": false, "isolation.level": "read_committed", kafkaJS: { groupId: "matchledger-spike4", autoCommit: false, readUncommitted: false, fromBeginning: true } });
console.log({ api: ["producer.transaction()", "transaction.send()", "transaction.sendOffsets({ consumer, topics })", "transaction.commit()", "transaction.abort()"], rebalanceHook: "rebalance_cb", expectedFenceCode: ErrorCodes.ERR__FENCED });
await producer.connect(); await consumer.connect();
try { const tx = await producer.transaction(); await tx.send({ topic: "matchledger-spike4", messages: [{ value: "committed" }] }); await tx.commit(); console.log("Committed transactional round-trip probe published."); } finally { await consumer.disconnect(); await producer.disconnect(); }

