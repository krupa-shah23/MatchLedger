CREATE TABLE IF NOT EXISTS recon_runs (
  run_id text PRIMARY KEY,
  source text NOT NULL,
  file_hash text NOT NULL UNIQUE,
  cutoff_ts bigint NOT NULL,
  price_decimals integer NOT NULL,
  settlement_lag_days integer NOT NULL,
  rows_read bigint NOT NULL,
  parse_errors_json jsonb NOT NULL,
  counts_json jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS recon_breaks (
  break_id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES recon_runs(run_id),
  type text NOT NULL,
  trade_id text NOT NULL,
  internal_json jsonb,
  external_json jsonb,
  status text NOT NULL CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'WRITTEN_OFF')),
  reason text,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recon_breaks_run ON recon_breaks (run_id, type, status);

CREATE TABLE IF NOT EXISTS recon_audit (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  break_id text NOT NULL REFERENCES recon_breaks(break_id),
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  actor text NOT NULL CHECK (btrim(actor) <> ''),
  ts bigint NOT NULL,
  adjustment_id text
);
