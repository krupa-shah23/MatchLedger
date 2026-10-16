import { KafkaJS } from "@confluentinc/kafka-javascript";
// Spike 4 (T10-T14). Run against the compose Kafka: RUN_KAFKA_SPIKE=1 npm test.
const { Kafka } = KafkaJS;
const brokers = [process.env.KAFKA_BROKER ?? "localhost:29092"];
const kafka = new Kafka({ kafkaJS: { brokers } });
const run = Date.now().toString(36);
const topicIn = `spike4-in-${run}`;
const topicOut = `spike4-out-${run}`;
const txId = `matchledger-spike4-${run}`;
const admin = kafka.admin();
await admin.connect();
await admin.createTopics({ topics: [topicIn, topicOut].map((topic) => ({ topic, numPartitions: 1 })) });
await admin.disconnect();
const mkProducer = () => kafka.producer({ "transactional.id": txId, "enable.idempotence": true, kafkaJS: { acks: -1 } });
const mkConsumer = (groupId) => kafka.consumer({
    "group.protocol": "classic",
    "enable.auto.commit": false,
    "isolation.level": "read_committed",
    kafkaJS: { groupId, autoCommit: false, fromBeginning: true },
});
async function readAll(topic, groupId, ms) {
    const consumer = mkConsumer(groupId);
    const seen = [];
    await consumer.connect();
    await consumer.subscribe({ topic });
    await consumer.run({ eachMessage: async ({ message }) => void seen.push(String(message.value)) });
    await new Promise((resolve) => setTimeout(resolve, ms));
    await consumer.disconnect();
    return seen;
}
// T10: transactional commit round-trips to a read_committed consumer.
const p1 = mkProducer();
await p1.connect();
const tx1 = await p1.transaction();
await tx1.send({ topic: topicIn, messages: [{ value: "committed" }] });
await tx1.commit();
console.log("T10 read_committed sees:", await readAll(topicIn, `g10-${run}`, 8000));
// T12: aborted transaction is invisible.
const tx2 = await p1.transaction();
await tx2.send({ topic: topicIn, messages: [{ value: "aborted" }] });
await tx2.abort();
console.log("T12 after abort (expect no 'aborted'):", await readAll(topicIn, `g12-${run}`, 8000));
// T11: consume-process-produce with sendOffsets.
const cpp = mkConsumer(`g11-${run}`);
await cpp.connect();
await cpp.subscribe({ topic: topicIn });
let sent = false;
await cpp.run({
    eachMessage: async ({ topic, partition, message }) => {
        if (sent)
            return;
        sent = true;
        const tx = await p1.transaction();
        await tx.send({ topic: topicOut, messages: [{ value: `processed:${String(message.value)}` }] });
        await tx.sendOffsets({
            consumer: cpp,
            topics: [{ topic, partitions: [{ partition, offset: (BigInt(message.offset) + 1n).toString() }] }],
        });
        await tx.commit();
    },
});
await new Promise((resolve) => setTimeout(resolve, 8000));
await cpp.disconnect();
console.log("T11 output topic:", await readAll(topicOut, `g11o-${run}`, 8000));
// T13: second producer with the same transactional.id fences the first.
const p2 = mkProducer();
await p2.connect();
try {
    const tx = await p1.transaction();
    await tx.send({ topic: topicIn, messages: [{ value: "zombie" }] });
    await tx.commit();
    console.log("T13 FAILED: zombie producer was not fenced");
}
catch (error) {
    const e = error;
    console.log("T13 fenced:", { name: e.name, code: e.code, message: e.message });
}
// T14: rebalance hook (librdkafka property rebalance_cb; revoke/lost reported by the client).
const rb = kafka.consumer({
    "group.protocol": "classic",
    "enable.auto.commit": false,
    "rebalance_cb": (err, assignment) => console.log("T14 rebalance_cb", err.code, assignment),
    kafkaJS: { groupId: `g14-${run}`, autoCommit: false, fromBeginning: true },
});
await rb.connect();
await rb.subscribe({ topic: topicIn });
await rb.run({ eachMessage: async () => undefined });
await new Promise((resolve) => setTimeout(resolve, 8000));
await rb.disconnect();
await p2.disconnect().catch(() => undefined);
await p1.disconnect().catch(() => undefined);
