-- Migration 018: Verify replay support (snapshot checksums for integrity)
-- Adds checksum column to snapshots table for /system/verify-replay endpoint

ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);

CREATE INDEX IF NOT EXISTS snapshots_checksum ON snapshots(checksum);

-- Backfill checksums for existing snapshots (optional, can be done asynchronously)
-- UPDATE snapshots SET checksum = encode(digest(state_json::text, 'sha256'), 'hex')
-- WHERE checksum IS NULL;
