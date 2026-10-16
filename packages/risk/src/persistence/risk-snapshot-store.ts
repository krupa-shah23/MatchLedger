import { createHash } from "node:crypto";
import type { SqlExecutor } from "@matchledger/journal";
import { toSafeNumber } from "@matchledger/journal";
import type { RiskState } from "@matchledger/common";
import { deserializeRiskState, serializeRiskState } from "@matchledger/common";

export interface RiskSnapshotCandidate {
  lastSeq: number;
  lastTs: number;
  version: number;
  state?: RiskState;
  invalid?: "CHECKSUM" | "VERSION" | "DECODE" | "RESTORE";
  invalidReason?: string;
}

export class RiskSnapshotStore {
  constructor(private readonly sql: SqlExecutor) {}

  private streamId(partition: number): string {
    return `risk-snapshot-${partition}`;
  }

  async save(partition: number, lastSeq: number, lastTs: number, state: RiskState): Promise<void> {
    const stateJson = serializeRiskState(state);
    const checksum = createHash("sha256").update(stateJson).digest("hex");
    await this.sql.query(
      `INSERT INTO snapshots (stream_id, last_seq, last_ts, schema_version, state_json, checksum)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6) ON CONFLICT (stream_id, last_seq) DO NOTHING`,
      [this.streamId(partition), lastSeq, lastTs, 1, stateJson, checksum],
    );
  }

  /** Newest-first candidates at or below maxSeq. Each candidate reports why it is
   * invalid (if at all) without throwing, so the caller can fall back to the next
   * older one. */
  async listCandidates(partition: number, maxSeq: number): Promise<readonly RiskSnapshotCandidate[]> {
    const res = await this.sql.query(
      `SELECT last_seq, last_ts, schema_version, state_json::text as state_text, checksum
       FROM snapshots WHERE stream_id = $1 AND last_seq <= $2 ORDER BY last_seq DESC LIMIT 10`,
      [this.streamId(partition), maxSeq],
    );

    return res.rows.map((row) => {
      const r = row as { last_seq: string | number; last_ts: string | number; schema_version: number; state_text: string; checksum: string };
      const lastSeq = toSafeNumber(r.last_seq);
      const lastTs = toSafeNumber(r.last_ts);
      const version = toSafeNumber(r.schema_version);

      // Version is checked BEFORE attempting to decode, since deserializeRiskState
      // itself asserts version === 1 and would throw DECODE for a version mismatch
      // instead of reporting the more specific VERSION reason.
      if (version !== 1) {
        return { lastSeq, lastTs, version, invalid: "VERSION" as const };
      }

      // Checksum is verified over a CANONICAL round trip (decode then re-encode
      // with our own serializer), not over the raw jsonb::text the database
      // returns: Postgres's jsonb storage does not preserve the original byte
      // formatting (key order/whitespace), so hashing the stored text directly
      // against a checksum computed at save() time over our serializer's output
      // would almost never match, even for untampered data.
      let state: RiskState;
      try {
        state = deserializeRiskState(r.state_text);
      } catch (err) {
        return { lastSeq, lastTs, version, invalid: "DECODE" as const, invalidReason: String(err) };
      }
      const recomputedChecksum = createHash("sha256").update(serializeRiskState(state)).digest("hex");
      if (recomputedChecksum !== r.checksum) {
        return { lastSeq, lastTs, version, invalid: "CHECKSUM" as const };
      }
      return { lastSeq, lastTs, version, state };
    });
  }

  async prune(partition: number, keep: number): Promise<void> {
    const res = await this.sql.query(
      `SELECT last_seq FROM snapshots WHERE stream_id = $1 ORDER BY last_seq DESC LIMIT 1 OFFSET $2`,
      [this.streamId(partition), keep],
    );
    const row = res.rows[0] as { last_seq: string | number } | undefined;
    if (row !== undefined) {
      await this.sql.query(`DELETE FROM snapshots WHERE stream_id = $1 AND last_seq <= $2`, [this.streamId(partition), toSafeNumber(row.last_seq)]);
    }
  }
}
