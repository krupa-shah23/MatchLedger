import { Engine, InvalidSnapshotError, OrderBook } from "@matchledger/engine-core";
import type { InstrumentSpec } from "@matchledger/engine-core";
import type { JournalReader, RecoveredState, ShardOutput, SnapshotStore } from "@matchledger/common";

export type { JournalReader, RecoveredState, SnapshotCandidate, SnapshotStore } from "@matchledger/common";

export type PgJournal = JournalReader & {
  readonly append: (batch: readonly unknown[]) => Promise<void>;
  readonly appendEvents: (batch: readonly ShardOutput[]) => Promise<void>;
};

export class JournalGapError extends Error {
  public constructor(public readonly symbol: string, public readonly expected: number, public readonly got: number) {
    super(`JournalGapError: ${symbol} expected seq ${expected} but found ${got}`);
    this.name = "JournalGapError";
  }
}

export class ReplayMismatchError extends Error {
  public constructor(
    public readonly symbol: string,
    public readonly seq: number,
    public readonly expected: unknown,
    public readonly actual: unknown,
    public readonly diff: string,
  ) {
    super(`ReplayMismatchError: ${symbol} seq ${seq} mismatch: ${diff}`);
    this.name = "ReplayMismatchError";
  }
}

type ReplayBook = {
  readonly apply: (command: unknown) => readonly unknown[];
  readonly checkInvariants: () => string[];
};

export type RecoveryResult = {
  readonly symbol: string;
  readonly book: ReplayBook;
  readonly lastSeq: number;
  readonly lastTs: number;
  readonly replayed: number;
  readonly verified: number;
  readonly regenerated: readonly ShardOutput[];
  readonly snapshotUsed?: { readonly lastSeq: number };
  readonly invalidSnapshots: readonly { readonly lastSeq: number; readonly reason: string }[];
};

export type RecoveredStreamState = {
  readonly book: ReplayBook;
  readonly lastSeq: number;
  readonly lastTs: number;
};

const canonicalJson = (value: unknown): string => {
  const normalize = (input: unknown): unknown => {
    if (typeof input === "bigint") return input.toString();
    if (Array.isArray(input)) return input.map((entry) => normalize(entry));
    if (input !== null && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, normalize(entry)]),
      );
    }
    return input;
  };

  const serialized = JSON.stringify(normalize(value));
  return serialized ?? "undefined";
};

const readableMismatch = (expected: unknown, actual: unknown): string => {
  const expectedText = canonicalJson(expected);
  const actualText = canonicalJson(actual);
  return expectedText === actualText
    ? "expected and actual canonical JSON are identical"
    : `expected=${expectedText} actual=${actualText}`;
};

export async function recoverStream(args: {
  readonly journal: PgJournal;
  readonly snapshots: SnapshotStore;
  readonly symbol: string;
  readonly spec: InstrumentSpec;
  readonly chunkSize?: number;
}): Promise<RecoveryResult> {
  const chunkSize = args.chunkSize ?? 128;
  const maxSeq = await args.journal.lastCommandSeq(args.symbol);
  const invalidSnapshots: { readonly lastSeq: number; readonly reason: string }[] = [];

  let book: ReplayBook | undefined;
  let snapshotUsed: { readonly lastSeq: number } | undefined;
  let lastSeq = 0;
  let lastTs = 0;

  const candidates = await args.snapshots.listCandidates(args.symbol, { maxSeq });
  for (const candidate of candidates) {
    if (candidate.lastSeq > maxSeq) {
      invalidSnapshots.push({ lastSeq: candidate.lastSeq, reason: "AHEAD_OF_JOURNAL" });
      continue;
    }

    try {
      const state = candidate.data;
      if (state === undefined || state === null || typeof state !== "object") {
        throw new Error("DECODE");
      }

      const snapshotVersion = (state as { readonly version?: number }).version ?? candidate.version;
      if (snapshotVersion !== undefined && snapshotVersion !== 1) {
        throw new Error("UNKNOWN_VERSION");
      }

      const restored = OrderBook.restore(args.spec, state as Parameters<typeof OrderBook.restore>[1]) as unknown as ReplayBook;
      const violations = restored.checkInvariants();
      if (violations.length > 0) {
        throw new Error(violations.join("; "));
      }

      book = restored;
      snapshotUsed = { lastSeq: candidate.lastSeq };
      lastSeq = candidate.lastSeq;
      lastTs = candidate.lastTs ?? 0;
      break;
    } catch (error: unknown) {
      if (error instanceof InvalidSnapshotError) {
        invalidSnapshots.push({ lastSeq: candidate.lastSeq, reason: error.reason });
        continue;
      }
      const reason =
        candidate.version !== undefined && candidate.version !== 1
          ? "UNKNOWN_VERSION"
          : error instanceof Error && error.message === "DECODE"
            ? "DECODE"
            : error instanceof Error && error.message.includes("checksum")
              ? "CHECKSUM"
              : "DECODE";
      invalidSnapshots.push({ lastSeq: candidate.lastSeq, reason });
    }
  }

  if (book === undefined) {
    book = new Engine(args.spec) as unknown as ReplayBook;
  }

  const regenerated: ShardOutput[] = [];
  let replayed = 0;
  let verified = 0;

  const commands = await args.journal.readCommands(args.symbol, lastSeq, chunkSize);
  if (commands.length === 0) {
    return {
      symbol: args.symbol,
      book,
      lastSeq,
      lastTs,
      replayed,
      verified,
      regenerated,
      snapshotUsed,
      invalidSnapshots,
    };
  }

  const expectedFirst = lastSeq + 1;
  const firstChunkSeq = commands[0]!.seq;
  if (firstChunkSeq !== expectedFirst) {
    throw new JournalGapError(args.symbol, expectedFirst, firstChunkSeq);
  }

  const maxChunkSeq = commands[commands.length - 1]!.seq;
  const storedEvents = await args.journal.readEvents(args.symbol, firstChunkSeq, maxChunkSeq);
  const storedBySeq = new Map<number, readonly unknown[]>();
  for (const event of storedEvents) {
    const existing = storedBySeq.get(event.seq) ?? [];
    storedBySeq.set(event.seq, [...existing, event.payload]);
  }

  for (const commandRow of commands) {
    const expected = lastSeq + 1;
    if (commandRow.seq !== expected) {
      throw new JournalGapError(args.symbol, expected, commandRow.seq);
    }

    const generated = book.apply(commandRow.command as never) as readonly unknown[];
    const storedForSeq = storedBySeq.get(commandRow.seq) ?? [];
    if (storedForSeq.length > 0) {
      const actual = generated;
      const expectedValue = storedForSeq;
      if (canonicalJson(expectedValue) !== canonicalJson(actual)) {
        throw new ReplayMismatchError(
          args.symbol,
          commandRow.seq,
          expectedValue,
          actual,
          readableMismatch(expectedValue, actual),
        );
      }
      verified += 1;
    } else {
      regenerated.push({
        symbol: args.symbol,
        seq: commandRow.seq,
        ts: commandRow.ts,
        command: commandRow.command as never,
        events: generated as readonly never[],
      });
    }

    lastSeq = commandRow.seq;
    lastTs = Math.max(lastTs, commandRow.ts);
    replayed += 1;
  }

  return {
    symbol: args.symbol,
    book,
    lastSeq,
    lastTs,
    replayed,
    verified,
    regenerated,
    snapshotUsed,
    invalidSnapshots,
  };
}

export async function recoverShard(args: {
  readonly journal: PgJournal;
  readonly snapshots: SnapshotStore;
  readonly symbols: ReadonlyMap<string, InstrumentSpec>;
  readonly chunkSize?: number;
}): Promise<{ readonly recovered: RecoveredState; readonly regenerated: readonly ShardOutput[]; readonly results: readonly RecoveryResult[] }> {
  const results: RecoveryResult[] = [];
  const regenerated: ShardOutput[] = [];
  const streams = new Map<string, RecoveredStreamState>();
  const lastSeqBySymbol = new Map<string, number>();
  let lastTs = Number.NEGATIVE_INFINITY;

  for (const [symbol, spec] of args.symbols) {
    const result = await recoverStream({
      journal: args.journal,
      snapshots: args.snapshots,
      symbol,
      spec,
      chunkSize: args.chunkSize,
    });
    results.push(result);
    streams.set(symbol, { book: result.book, lastSeq: result.lastSeq, lastTs: result.lastTs });
    lastSeqBySymbol.set(symbol, result.lastSeq);
    lastTs = Math.max(lastTs, result.lastTs);
    if (result.regenerated.length > 0) {
      regenerated.push(...result.regenerated);
    }
  }

  if (regenerated.length > 0) {
    await args.journal.appendEvents(regenerated);
  }

  return {
    recovered: {
      streams: new Map(streams) as unknown as RecoveredState["streams"],
      lastSeqBySymbol: new Map(lastSeqBySymbol),
      lastTs,
    },
    regenerated,
    results,
  };
}
