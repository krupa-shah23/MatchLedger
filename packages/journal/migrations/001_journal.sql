CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT NOT NULL PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal (
  stream_id TEXT NOT NULL,
  seq BIGINT NOT NULL CHECK (seq >= 1),
  record_type TEXT NOT NULL CHECK (record_type IN ('COMMAND', 'EVENT')),
  idx INTEGER NOT NULL CHECK (idx >= 0),
  schema_version SMALLINT NOT NULL CHECK (schema_version >= 1),
  ts BIGINT NOT NULL CHECK (ts >= 0),
  writer_epoch BIGINT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, seq, record_type, idx),
  CHECK (record_type <> 'COMMAND' OR idx = 0)
);

CREATE INDEX IF NOT EXISTS idx_journal_stream_seq ON journal (stream_id, seq);
