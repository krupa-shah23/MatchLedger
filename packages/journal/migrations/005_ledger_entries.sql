CREATE TABLE IF NOT EXISTS ledger_entries (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tx_id text NOT NULL,
  leg_idx integer NOT NULL CHECK (leg_idx >= 0),
  account_id text NOT NULL,
  asset text NOT NULL,
  amount bigint NOT NULL CHECK (amount <> 0),
  direction text NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  ref_event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tx_id, leg_idx),
  CHECK ((direction = 'DEBIT' AND amount < 0) OR (direction = 'CREDIT' AND amount > 0))
);
CREATE INDEX IF NOT EXISTS ledger_entries_account_asset ON ledger_entries (account_id, asset);
