import type { SqlExecutor } from "@matchledger/journal";
import { JournalGapError, ReplayMismatchError } from "@matchledger/journal";
import type { RiskConfig, RiskEvent, RiskOutput } from "@matchledger/common";
import { serializeRiskEvent } from "@matchledger/common";
import { RiskCore } from "../core/risk-core.js";
import { InvalidRiskStateError } from "../core/errors.js";
import { PgRiskJournal } from "../persistence/pg-risk-journal.js";
import { RiskSnapshotStore } from "../persistence/risk-snapshot-store.js";

export interface RecoverRiskPartitionResult {
  partition: number;
  core: RiskCore;
  lastSeq: number;
  lastTs: number;
  replayed: number;
  verified: number;
  regenerated: readonly RiskOutput[];
  snapshotUsed?: { lastSeq: number };
  invalidSnapshots: readonly { lastSeq: number; reason: string }[];
}

function sortedCanonical(events: readonly RiskEvent[]): string {
  return events.map((e) => serializeRiskEvent(e)).join("|");
}

export async function recoverRiskPartition(args: {
  sql: SqlExecutor;
  partition: number;
  config: RiskConfig;
  chunkSize?: number;
}): Promise<RecoverRiskPartitionResult> {
  const { sql, partition, config } = args;
  const chunkSize = args.chunkSize ?? 1000;

  const journal = await PgRiskJournal.create(sql, { partition, writerEpoch: 1n });
  const snapshotStore = new RiskSnapshotStore(sql);

  const maxSeq = await journal.lastCommandSeq();
  const invalidSnapshots: { lastSeq: number; reason: string }[] = [];

  let core: RiskCore | undefined;
  let fromSeq = 0;
  let snapshotUsed: { lastSeq: number } | undefined;

  const candidates = await snapshotStore.listCandidates(partition, maxSeq);
  for (const candidate of candidates) {
    if (candidate.invalid !== undefined) {
      invalidSnapshots.push({ lastSeq: candidate.lastSeq, reason: candidate.invalidReason ?? candidate.invalid });
      continue;
    }
    try {
      core = RiskCore.restore(config, candidate.state!, partition);
      fromSeq = candidate.lastSeq;
      snapshotUsed = { lastSeq: candidate.lastSeq };
      break;
    } catch (err) {
      const reason = err instanceof InvalidRiskStateError ? `${err.reason}: ${err.message}` : String(err);
      invalidSnapshots.push({ lastSeq: candidate.lastSeq, reason });
    }
  }

  if (core === undefined) {
    core = new RiskCore(config);
    fromSeq = 0;
  }

  let replayed = 0;
  let verified = 0;
  let lastSeq = fromSeq;
  let lastTs = 0;
  const regenerated: RiskOutput[] = [];

  let cursor = fromSeq;
  for (;;) {
    const batch = await journal.readCommands(cursor, chunkSize);
    if (batch.length === 0) break;

    const firstSeq = batch[0]!.seq;
    const lastSeqInBatch = batch[batch.length - 1]!.seq;
    const storedEventsByeq = await journal.readEvents(firstSeq, lastSeqInBatch);

    for (const cmd of batch) {
      if (cmd.seq !== lastSeq + 1) {
        throw new JournalGapError(`risk-${partition}`, lastSeq + 1, cmd.seq);
      }

      const regeneratedEvents = core.apply(cmd);
      replayed += 1;
      lastSeq = cmd.seq;
      lastTs = Math.max(lastTs, cmd.ts);

      const storedEvents = storedEventsByeq.get(cmd.seq);

      if (storedEvents === undefined) {
        regenerated.push({ partition, seq: cmd.seq, ts: cmd.ts, command: cmd.command, events: regeneratedEvents });
      } else {
        if (sortedCanonical(storedEvents) !== sortedCanonical(regeneratedEvents)) {
          throw new ReplayMismatchError(
            `risk-${partition}`,
            cmd.seq,
            storedEvents,
            regeneratedEvents,
            `stored=${sortedCanonical(storedEvents)} regenerated=${sortedCanonical(regeneratedEvents)}`,
          );
        }
        verified += 1;
      }
    }

    cursor = lastSeqInBatch;
    if (batch.length < chunkSize) break;
  }

  return { partition, core, lastSeq, lastTs, replayed, verified, regenerated, snapshotUsed, invalidSnapshots };
}
