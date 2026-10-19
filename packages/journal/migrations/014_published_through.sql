CREATE TABLE published_through (
  lease_id text NOT NULL,
  symbol text NOT NULL,
  seq bigint NOT NULL CHECK (seq >= 0),
  PRIMARY KEY (lease_id, symbol)
);
