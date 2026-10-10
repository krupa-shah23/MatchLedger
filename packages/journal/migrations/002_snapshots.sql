CREATE TABLE IF NOT EXISTS snapshots (
  stream_id TEXT NOT NULL,
  last_seq BIGINT NOT NULL CHECK (last_seq >= 0),
  last_ts BIGINT NOT NULL,
  schema_version SMALLINT NOT NULL,
  state_json JSONB NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, last_seq)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_stream ON snapshots (stream_id, last_seq DESC);
