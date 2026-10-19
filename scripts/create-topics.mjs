#!/usr/bin/env node

/**
 * Idempotent Kafka topic creation for MatchLedger Week 10.
 * Creates orders.accepted, control.commands, and engine.events topics (4 partitions each).
 * Validates that existing topics have the correct partition count; fails if mismatched.
 * Runs after docker-compose up to ensure topics exist before tests.
 *
 * Usage: node scripts/create-topics.mjs [--bootstrap-server localhost:29092]
 */

import { KafkaJS } from "@confluentinc/kafka-javascript";

const { Kafka } = KafkaJS;
const bootstrapServer = process.argv[2]?.split("=")[1] ?? process.env.KAFKA_BOOTSTRAP_SERVERS ?? "localhost:29092";

const kafka = new Kafka({ kafkaJS: { brokers: [bootstrapServer] } });
const admin = kafka.admin();

const expectedTopics = [
  { topic: "orders.accepted", numPartitions: 4, replicationFactor: 1 },
  { topic: "control.commands", numPartitions: 4, replicationFactor: 1 },
  { topic: "engine.events", numPartitions: 4, replicationFactor: 1 },
];

async function getExistingTopics() {
  try {
    const metadata = await admin.fetchTopicMetadata();
    return new Map((metadata.topics || []).map((t) => [t.name, t.partitions.length]));
  } catch {
    return new Map();
  }
}

async function createTopics() {
  try {
    await admin.connect();
    console.log(`[topic-creator] Connected to ${bootstrapServer}`);

    // Get existing topics
    let existing = await getExistingTopics();

    // Check for partition count mismatches
    const mismatched = expectedTopics.filter((exp) => {
      if (!existing.has(exp.topic)) return false;
      return existing.get(exp.topic) !== exp.numPartitions;
    });

    if (mismatched.length > 0) {
      console.error("[topic-creator] FATAL: Partition count mismatch:");
      for (const t of mismatched) {
        console.error(`  ${t.topic}: expected ${t.numPartitions}, found ${existing.get(t.topic)}`);
      }
      await admin.disconnect();
      process.exit(1);
    }

    // Create missing topics
    const toCreate = expectedTopics.filter((t) => !existing.has(t.topic));

    if (toCreate.length === 0) {
      console.log("[topic-creator] All topics already exist with correct partition counts:");
      for (const t of expectedTopics) {
        console.log(`  ✓ ${t.topic}: ${existing.get(t.topic)} partitions (verified)`);
      }
    } else {
      console.log(`[topic-creator] Creating ${toCreate.length} topic(s)...`);
      try {
        await admin.createTopics({ topics: toCreate });
        console.log("[topic-creator] Topics created:");
        for (const t of toCreate) {
          console.log(`  ✓ ${t.topic}: ${t.numPartitions} partitions`);
        }
        // Report pre-existing topics
        for (const t of expectedTopics) {
          if (existing.has(t.topic)) {
            console.log(`  ✓ ${t.topic}: ${existing.get(t.topic)} partitions (pre-existing)`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists") || msg.includes("ALREADY_EXISTS")) {
          console.log("[topic-creator] Some topics already exist (concurrent creation):");
          // Refresh and report status
          await new Promise((resolve) => setTimeout(resolve, 1000));
          existing = await getExistingTopics();
          for (const t of toCreate) {
            const status = existing.has(t.topic) ? `${existing.get(t.topic)} partitions` : "pending";
            console.log(`  ✓ ${t.topic}: ${status}`);
          }
        } else {
          throw err;
        }
      }
    }

    console.log("[topic-creator] Success: all topics are ready");
    await admin.disconnect();
    process.exit(0);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[topic-creator] Fatal error: ${msg}`);
    try {
      await admin.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

createTopics();
