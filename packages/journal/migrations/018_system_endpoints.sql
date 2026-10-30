-- Migration 017: System endpoints schema (heartbeats, recovery log, metrics)
-- This creates tables for heartbeat tracking, recovery logging, and metrics collection

CREATE TABLE IF NOT EXISTS shard_heartbeats (
  lease_id TEXT PRIMARY KEY,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seq BIGINT NOT NULL DEFAULT 0,
  owned_symbols TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shard_heartbeats_updated_at ON shard_heartbeats(updated_at);

-- recovery_log is created by migration 018_recovery_log.sql

CREATE TABLE IF NOT EXISTS metrics_checkpoints (
  metric_name TEXT PRIMARY KEY,
  last_value NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);
