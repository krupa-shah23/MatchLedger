-- Recovery log: track shard recovery operations for observability
CREATE TABLE recovery_log (
  id bigserial PRIMARY KEY,
  lease_id text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  duration_ms bigint NOT NULL,
  snapshot_seq bigint NOT NULL,
  tail_length bigint NOT NULL,
  symbols_recovered text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recovery_log_lease ON recovery_log(lease_id);
CREATE INDEX idx_recovery_log_ts ON recovery_log(completed_at);
