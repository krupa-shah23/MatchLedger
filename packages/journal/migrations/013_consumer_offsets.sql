CREATE TABLE consumer_offsets (
  lease_id text NOT NULL,
  topic text NOT NULL,
  partition integer NOT NULL,
  next_offset bigint NOT NULL CHECK (next_offset >= 0),
  writer_epoch bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lease_id, topic, partition)
);
