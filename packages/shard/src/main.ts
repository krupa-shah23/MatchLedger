#!/usr/bin/env node
/**
 * Shard process entry point: config parsing, startup checks, signal handling, fail-stop.
 * SIGTERM: stop consuming, drain runners, release leases, exit.
 * Second SIGTERM: force exit.
 * Fail-stop on: FencedWriterError, fenced producer, unhandledRejection, uncaughtException.
 */

import { z } from "zod";
import { createPool } from "@matchledger/journal";
import { PartitionConsumer, checkTopics } from "@matchledger/transport";
import { ShardHost } from "./shard-host.js";

const ConfigSchema = z.object({
  TRANSPORT: z.enum(["inproc", "kafka"]),
  KAFKA_BROKERS: z.string().default("localhost:29092"),
  SHARD_ID: z.string(),
  SHARD_PARTITIONS: z.coerce.number().int().positive().default(4),
  RISK_PARTITIONS: z.coerce.number().int().positive().default(1),
  SESSION_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  MAX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
  TXN_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  QUEUE_CAPACITY: z.coerce.number().int().positive().default(10000),
  MAX_BATCH: z.coerce.number().int().positive().default(1000),
  DEDUPE_WINDOW_SEQ: z.coerce.number().int().positive().default(100000),
  SNAPSHOT_EVERY: z.coerce.number().int().positive().default(10000),
  SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(30000),
  PROFILE: z.enum(["demo", "prod"]).default("prod"),
  DATABASE_URL: z.string().default("postgres://postgres:matchledger@localhost:5432/postgres"),
});

type Config = z.infer<typeof ConfigSchema>;

async function main(): Promise<void> {
  let config: Config;

  try {
    config = ConfigSchema.parse(process.env);
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("\n")
      : String(error);
    console.error(`Configuration error:\n${message}`);
    process.exit(1);
  }

  let pool: any;
  let consumer: PartitionConsumer | null = null;
  let shardHost: ShardHost | null = null;
  let sigTermCount = 0;

  try {
    console.log(`[shard] Starting with SHARD_ID=${config.SHARD_ID}, TRANSPORT=${config.TRANSPORT}`);

    // Connect to database
    pool = createPool({ connectionString: config.DATABASE_URL });

    // Startup checks: verify topics exist and partition counts match
    if (config.TRANSPORT === "kafka") {
      const brokers = config.KAFKA_BROKERS.split(",");
      await checkTopics(brokers, [
        { name: "orders.accepted", partitions: config.SHARD_PARTITIONS },
        { name: "control.commands", partitions: config.SHARD_PARTITIONS },
        { name: "engine.events", partitions: config.SHARD_PARTITIONS },
      ]);
      console.log("[shard] Startup checks passed: all topics exist with correct partition counts");
    }

    // Initialize consumer and shard host
    if (config.TRANSPORT === "kafka") {
      const brokers = config.KAFKA_BROKERS.split(",");
      consumer = new PartitionConsumer({
        brokers,
        groupId: `shard-${config.SHARD_ID}`,
        groupInstanceId: config.SHARD_ID,
      });

      await consumer.init();
      console.log("[shard] Consumer initialized");

      // Create shard host with rebalance callbacks
      shardHost = new ShardHost({
        pool,
        consumer,
        leaseStore: null as any, // Would be created with pool
        brokers,
        shardId: config.SHARD_ID,
        runnerFactory: null as any, // Would be created with engine core
        recoverSymbol: null as any, // Would be created with engine core
      });

      // Subscribe to partitions (rebalance callbacks)
      await consumer.run(
        (msg: any) => shardHost!.onMessage(msg),
        (error: any) => {
          console.error("[shard] Consumer error:", error.message);
          failStop(error);
        }
      );
    }

    // Signal handling: SIGTERM for graceful shutdown
    process.on("SIGTERM", async () => {
      sigTermCount++;

      if (sigTermCount === 1) {
        console.log("[shard] SIGTERM received, graceful shutdown starting...");

        try {
          // Stop consuming
          if (consumer) {
            await consumer.disconnect();
          }

          // Stop runners with drain (finish open transaction)
          if (shardHost) {
            await shardHost.shutdown();
          }

          // Release leases and flush journal
          if (pool) {
            // All leases released by ShardHost.shutdown
            await pool.end();
          }

          console.log("[shard] Graceful shutdown complete");
          process.exit(0);
        } catch (error) {
          console.error("[shard] Error during shutdown:", error);
          process.exit(1);
        }
      } else if (sigTermCount >= 2) {
        console.log("[shard] SIGTERM received again, forcing exit");
        process.exit(1);
      }
    });

    // Fail-stop on unhandled rejection or exception
    process.on("unhandledRejection", (reason, promise) => {
      console.error("[shard] Unhandled rejection:", reason);
      failStop(new Error(`Unhandled rejection: ${reason}`));
    });

    process.on("uncaughtException", (error) => {
      console.error("[shard] Uncaught exception:", error);
      failStop(error);
    });

  } catch (error) {
    console.error("[shard] Fatal startup error:", error);
    failStop(error instanceof Error ? error : new Error(String(error)));
  }
}

function failStop(error: Error): void {
  console.error("[shard] Fail-stop due to:", error.message);

  if (error.message.includes("fenced") || error.message.includes("FencedWriterError")) {
    console.error("[shard] Fenced write detected, exiting");
  }

  process.exit(1);
}

// Run main
main().catch((error) => {
  console.error("[shard] Unexpected error:", error);
  process.exit(1);
});
