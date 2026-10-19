/**
 * Projection checkpoint management.
 * Checkpoints lock-before-read to ensure exactly-once.
 */

export interface CheckpointRow {
  projection: string;
  stream_id: string;
  last_seq: number;
}

/**
 * Fetch checkpoint with FOR UPDATE lock, creating if absent.
 * Must be called inside a transaction.
 * Inserts row at seq 0 if absent.
 */
export async function fetchCheckpoint(
  executor: { query: (sql: string, params: unknown[]) => Promise<{ rows: CheckpointRow[] }> },
  projection: string,
  streamId: string
): Promise<CheckpointRow> {
  // Lock and read checkpoint
  const rows = await executor.query(
    `SELECT projection, stream_id, last_seq FROM projection_checkpoints
     WHERE projection = $1 AND stream_id = $2
     FOR UPDATE;`,
    [projection, streamId]
  );

  if (rows.rows.length > 0) {
    return rows.rows[0] as CheckpointRow;
  }

  // Insert if absent (inside transaction, so safe)
  await executor.query(
    `INSERT INTO projection_checkpoints (projection, stream_id, last_seq)
     VALUES ($1, $2, 0) ON CONFLICT DO NOTHING;`,
    [projection, streamId]
  );

  return { projection, stream_id: streamId, last_seq: 0 };
}

/**
 * Advance checkpoint to new seq in same transaction.
 */
export async function advanceCheckpoint(
  executor: { query: (sql: string, params: unknown[]) => Promise<unknown> },
  projection: string,
  streamId: string,
  newSeq: number
): Promise<void> {
  await executor.query(
    `UPDATE projection_checkpoints SET last_seq = $1, updated_at = now()
     WHERE projection = $2 AND stream_id = $3;`,
    [newSeq, projection, streamId]
  );
}
