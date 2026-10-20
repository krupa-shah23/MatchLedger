/**
 * Command router for cancels and halt/resume (Kafka mode, Week 10).
 * Routes client cancels and sweeper cancels through orders.accepted (keyed by symbol).
 * Routes halt/resume through control.commands (keyed by symbol).
 */

import { TransactionalProducer } from "@matchledger/transport";
import { encodeEnvelope } from "@matchledger/transport";
import { partitionOf } from "@matchledger/common";

export interface CommandRouterConfig {
  producer: TransactionalProducer;
  brokers: string[];
  shardPartitions: number;
}

/**
 * Route a cancel order (client or sweeper) through orders.accepted topic.
 * Key by symbol to maintain ordering relative to the original order.
 */
export async function routeCancel(
  config: CommandRouterConfig,
  symbol: string,
  orderId: string,
  accountId?: string
): Promise<void> {
  const partition = partitionOf(symbol, config.shardPartitions);

  const cancelCmd = {
    type: "CancelOrder",
    orderId,
    accountId: accountId || "system",
  };

  const envelope = {
    schemaVersion: 1,
    msgId: `cancel:${orderId}:${Date.now()}`,
    type: "CancelOrder",
    payload: cancelCmd,
  };

  await config.producer.sendBatch("orders.accepted", [
    {
      key: symbol,
      value: encodeEnvelope(envelope),
      partition,
    },
  ]);
}

/**
 * Route halt symbol through control.commands topic.
 */
export async function routeHalt(
  config: CommandRouterConfig,
  symbol: string,
  actor: string,
  reason: string
): Promise<void> {
  const partition = partitionOf(symbol, config.shardPartitions);

  const haltCmd = {
    type: "HaltSymbol",
    symbol,
    actor,
    reason,
  };

  const envelope = {
    schemaVersion: 1,
    msgId: `halt:${symbol}:${Date.now()}`,
    type: "HaltSymbol",
    payload: haltCmd,
  };

  await config.producer.sendBatch("control.commands", [
    {
      key: symbol,
      value: encodeEnvelope(envelope),
      partition,
    },
  ]);
}

/**
 * Route resume symbol through control.commands topic.
 */
export async function routeResume(
  config: CommandRouterConfig,
  symbol: string,
  actor: string,
  reason: string
): Promise<void> {
  const partition = partitionOf(symbol, config.shardPartitions);

  const resumeCmd = {
    type: "ResumeSymbol",
    symbol,
    actor,
    reason,
  };

  const envelope = {
    schemaVersion: 1,
    msgId: `resume:${symbol}:${Date.now()}`,
    type: "ResumeSymbol",
    payload: resumeCmd,
  };

  await config.producer.sendBatch("control.commands", [
    {
      key: symbol,
      value: encodeEnvelope(envelope),
      partition,
    },
  ]);
}

/**
 * Route kill shard (demo only) through control.commands topic.
 */
export async function routeKillShard(
  config: CommandRouterConfig,
  symbol: string,
  reason?: string
): Promise<void> {
  const partition = partitionOf(symbol, config.shardPartitions);

  const killCmd = {
    type: "KillShard",
    symbol,
    reason: reason || "Chaos test",
  };

  const envelope = {
    schemaVersion: 1,
    msgId: `kill:${symbol}:${Date.now()}`,
    type: "KillShard",
    payload: killCmd,
  };

  await config.producer.sendBatch("control.commands", [
    {
      key: symbol,
      value: encodeEnvelope(envelope),
      partition,
    },
  ]);
}

/**
 * Route freeze shard (demo only) through control.commands topic.
 */
export async function routeFreezeShard(
  config: CommandRouterConfig,
  symbol: string,
  durationMs: number,
  reason?: string
): Promise<void> {
  const partition = partitionOf(symbol, config.shardPartitions);

  const freezeCmd = {
    type: "FreezeShard",
    symbol,
    durationMs,
    reason: reason || "Chaos test",
  };

  const envelope = {
    schemaVersion: 1,
    msgId: `freeze:${symbol}:${Date.now()}`,
    type: "FreezeShard",
    payload: freezeCmd,
  };

  await config.producer.sendBatch("control.commands", [
    {
      key: symbol,
      value: encodeEnvelope(envelope),
      partition,
    },
  ]);
}
