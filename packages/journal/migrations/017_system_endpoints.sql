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

CREATE TABLE IF NOT EXISTS recovery_log (
  id BIGSERIAL PRIMARY KEY,
  lease_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  duration_ms BIGINT NOT NULL,
  snapshot_seq BIGINT NOT NULL,
  tail_length BIGINT NOT NULL,
  symbols_recovered TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recovery_log_lease_id ON recovery_log(lease_id);
CREATE INDEX IF NOT EXISTS recovery_log_completed_at ON recovery_log(completed_at DESC);

CREATE TABLE IF NOT EXISTS metrics_checkpoints (
  metric_name TEXT PRIMARY KEY,
  last_value NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON shard_heartbeats TO :app_role;
GRANT SELECT, INSERT ON recovery_log TO :app_role;
GRANT SELECT, INSERT, UPDATE ON metrics_checkpoints TO :app_role;
