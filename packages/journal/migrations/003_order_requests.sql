CREATE TABLE IF NOT EXISTS order_requests (
  account_id TEXT NOT NULL,
  client_order_id TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, client_order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_requests_order_id ON order_requests (order_id);
