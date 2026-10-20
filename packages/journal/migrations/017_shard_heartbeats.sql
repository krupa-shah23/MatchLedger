-- Shard heartbeat: unfenced upserts for liveness tracking
CREATE TABLE shard_heartbeats (
  lease_id text PRIMARY KEY,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  last_seq bigint NOT NULL DEFAULT 0,
  owned_symbols text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shard_heartbeats_ts ON shard_heartbeats(last_heartbeat_at);
