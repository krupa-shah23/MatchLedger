# Spike 4: Kafka Transactions and Consumer Groups (@confluentinc/kafka-javascript)

**Date:** 2026-10-19  
**Tests:** T10–T14 verified against Kafka 4.2.2 (KRaft) with @confluentinc/kafka-javascript 1.10.0  
**Status:** ✅ PASSING (42.89s)

This document records the real function names, error types, and callback signatures observed when running T10–T14 against a live Kafka broker.

---

## T10: Transactional Commit

**Test:** Verifies that a read_committed consumer sees messages after a transaction commits.

**Producer API:**
```typescript
const tx = await producer.transaction();
await tx.send({ topic, messages: [...] });
await tx.commit();  // Commits transaction atomically
```

**Consumer API:**
```typescript
const consumer = kafka.consumer({
  "isolation.level": "read_committed",  // Only sees committed messages
  kafkaJS: { groupId, autoCommit: false, fromBeginning: true }
});
await consumer.subscribe({ topic });
await consumer.run({ eachMessage: async ({ message }) => { ... } });
```

**Result:** read_committed consumer sees: `['committed']`

---

## T12: Aborted Transaction Invisibility

**Test:** Verifies that a read_committed consumer does NOT see messages from an aborted transaction.

**Producer API:**
```typescript
const tx = await producer.transaction();
await tx.send({ topic, messages: [{ value: "aborted" }] });
await tx.abort();  // Abort transaction (messages not visible)
```

**Result:** read_committed consumer sees: `['committed']` (the aborted message is invisible)

---

## T11: Consume-Process-Produce with Offset Commit

**Test:** Verifies consume-process-produce pattern: read a message, process it, write to output topic, and commit consumer offset atomically within a transaction.

**Producer API:**
```typescript
const tx = await producer.transaction();
await tx.send({ topic: outputTopic, messages: [...] });
await tx.sendOffsets({
  consumer: consumerInstance,
  topics: [
    {
      topic: inputTopic,
      partitions: [
        {
          partition: 0,
          offset: (BigInt(message.offset) + 1n).toString()  // Next offset to consume
        }
      ]
    }
  ]
});
await tx.commit();  // Atomically commit output message + consumer offset
```

**Consumer API:**
```typescript
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    // Process message, then send processed result + offset in same transaction
    const tx = await producer.transaction();
    // ... send and sendOffsets ...
    await tx.commit();
  }
});
```

**Result:** 
- Output topic contains: `['processed:committed']`
- Consumer offset committed atomically with the output message

---

## T13: Producer Fencing via transactional.id

**Test:** Verifies that a second producer with the same `transactional.id` fences the first producer, preventing it from writing to the cluster.

**Producer Setup:**
```typescript
const txId = "matchledger-spike4-xyz";
const p1 = kafka.producer({ "transactional.id": txId, ... });
const p2 = kafka.producer({ "transactional.id": txId, ... });  // Same ID

await p1.connect();
await p2.connect();  // p2 connection fences p1
```

**Error When Fenced Producer Attempts Write:**
```
name: "KafkaJSError"
code: -152
message: "Local: Purged in queue"
```

**Underlying Kafka Messages (observed in test output):**
- `"Broker: Producer attempted an operation with an old epoch"`
- `"Failed to add partitions to transaction: Local: This instance has been fenced by a newer instance (_FENCED)"`

**Guarantees:** 
- Exactly one producer with a given `transactional.id` can be active at any time
- Older producer instances are guaranteed to fail, preventing zombie writes
- Fencing is enforced at the broker level via epoch tracking

---

## T14: Consumer Rebalance Callback

**Test:** Verifies that rebalance callbacks are invoked when consumer group membership changes.

**Consumer Setup:**
```typescript
const consumer = kafka.consumer({
  "group.protocol": "classic",
  "enable.auto.commit": false,
  "rebalance_cb": (err: { code: number }, assignment: unknown) => {
    console.log("Rebalance", err.code, assignment);
  },
  kafkaJS: { groupId, autoCommit: false, fromBeginning: true }
});

await consumer.subscribe({ topic });
await consumer.run({ eachMessage: async () => { ... } });
```

**Callback Signature:**
```typescript
rebalance_cb(err: { code: number }, assignment: Array<{ topic: string; partition: number }>)
```

**Error Codes Observed:**

| Code | Meaning | When Fired |
|------|---------|-----------|
| `-175` | Assign Partitions | When partitions are assigned to this consumer (start of rebalance) |
| `-174` | Revoke Partitions | When partitions are revoked from this consumer (end of rebalance) |

**Example Output:**
```
T14 rebalance_cb -175 [ { topic: 'spike4-in-mvfi2hv0', partition: 0 } ]
  // Consumer assigned partition 0 of topic

T14 rebalance_cb -174 [ { topic: 'spike4-in-mvfi2hv0', partition: 0 } ]
  // Consumer revoked partition 0 of topic (group rebalancing)
```

**isLost Property:**
- Callback receives internal rebalance events with `isLost: false` when partitions are cleanly revoked
- `isLost: true` would indicate consumer was disconnected before completing revocation (not observed in normal operation)

---

## Event Loop Blocking and Timeouts

**Test Observations:**

When the JS event loop is blocked (via `setTimeout` without yielding), two timeouts can fire:

1. **`session.timeout.ms`** (default 10s)
   - Fired when broker receives no heartbeat from consumer
   - Causes consumer to be removed from group (triggers rebalance)
   - Results in partition revocation

2. **`max.poll.interval.ms`** (default 5m)
   - Fired when broker hasn't received a poll request
   - Less likely to fire in JS (short-lived blocking) unless processing takes >5 minutes
   - Would cause consumer to be considered dead

**In Spike 4:** The test uses 8-second `setTimeout` pauses, which allow session timeout (10s) to trigger naturally, causing rebalance callbacks. The JS event loop is not truly blocked (it's async/await with `setTimeout`), so `max.poll.interval.ms` does not fire.

---

## @confluentinc/kafka-javascript API Summary

### Producer
- `kafka.producer(config)` → producer instance
- `producer.connect()` → Promise<void>
- `producer.transaction()` → Promise<transaction>
- `producer.disconnect()` → Promise<void>

### Transaction
- `transaction.send({ topic, messages })` → Promise<void>
- `transaction.sendOffsets({ consumer, topics })` → Promise<void>
- `transaction.commit()` → Promise<void>
- `transaction.abort()` → Promise<void>

### Consumer
- `kafka.consumer(config)` → consumer instance
- `consumer.connect()` → Promise<void>
- `consumer.subscribe({ topic })` → Promise<void>
- `consumer.run({ eachMessage })` → Promise<void> (runs until disconnect)
- `consumer.disconnect()` → Promise<void>

### Error Handling
- All errors inherit `name: "KafkaJSError"`
- Fencing error: `code: -152, message: "Local: Purged in queue"`
- Check `error.code` for programmatic error handling

---

**Next:** Week 10 implementation can use these APIs directly for Kafka transport layer (KafkaEventSink in packages/transport).
