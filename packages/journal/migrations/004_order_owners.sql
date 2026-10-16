CREATE TABLE IF NOT EXISTS order_owners (
  order_id text PRIMARY KEY,
  account_id text NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_owners_account ON order_owners (account_id);
