CREATE TABLE shard_leases (
  lease_id text PRIMARY KEY,
  owner text NOT NULL,
  epoch bigint NOT NULL CHECK (epoch >= 0),
  acquired_at timestamptz NOT NULL DEFAULT now()
);
