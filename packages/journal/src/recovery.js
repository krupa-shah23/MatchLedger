import { Engine, InvalidSnapshotError, OrderBook } from "@matchledger/engine-core";
import { getUpcaster } from "@matchledger/common";
export class JournalGapError extends Error {
    symbol;
    expected;
    got;
    constructor(symbol, expected, got) {
        super(`JournalGapError: ${symbol} expected seq ${expected} but found ${got}`);
        this.symbol = symbol;
        this.expected = expected;
        this.got = got;
        this.name = "JournalGapError";
    }
}
export class ReplayMismatchError extends Error {
    symbol;
    seq;
    expected;
    actual;
    diff;
    constructor(symbol, seq, expected, actual, diff) {
        super(`ReplayMismatchError: ${symbol} seq ${seq} mismatch: ${diff}`);
        this.symbol = symbol;
        this.seq = seq;
        this.expected = expected;
        this.actual = actual;
        this.diff = diff;
        this.name = "ReplayMismatchError";
    }
}
const canonicalJson = (value) => {
    const normalize = (input) => {
        if (typeof input === "bigint")
            return input.toString();
        if (Array.isArray(input))
            return input.map((entry) => normalize(entry));
        if (input !== null && typeof input === "object") {
            return Object.fromEntries(Object.entries(input)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, entry]) => [key, normalize(entry)]));
        }
        return input;
    };
    const serialized = JSON.stringify(normalize(value));
    return serialized ?? "undefined";
};
const readableMismatch = (expected, actual) => {
    const expectedText = canonicalJson(expected);
    const actualText = canonicalJson(actual);
    return expectedText === actualText
        ? "expected and actual canonical JSON are identical"
        : `expected=${expectedText} actual=${actualText}`;
};
export async function recoverStream(args) {
    const chunkSize = args.chunkSize ?? 128;
    const maxSeq = await args.journal.lastCommandSeq(args.symbol);
    const invalidSnapshots = [];
    let book;
    let snapshotUsed;
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
            const snapshotVersion = Number(state?.version ?? candidate.version ?? 1);
            if (snapshotVersion === 1) {
                const upcast = getUpcaster(1);
                const normalized = upcast === undefined ? { ...state, version: 2, breaker: undefined } : upcast(state);
                const restored = OrderBook.restore(args.spec, normalized, args.breakerConfig);
                const violations = restored.checkInvariants();
                if (violations.length > 0) {
                    throw new Error(violations.join("; "));
                }
                book = restored;
                snapshotUsed = { lastSeq: candidate.lastSeq };
                lastSeq = candidate.lastSeq;
                lastTs = candidate.lastTs ?? 0;
                break;
            }
            if (snapshotVersion !== 2) {
                throw new Error("UNKNOWN_VERSION");
            }
            const restored = OrderBook.restore(args.spec, state, args.breakerConfig);
            const violations = restored.checkInvariants();
            if (violations.length > 0) {
                throw new Error(violations.join("; "));
            }
            book = restored;
            snapshotUsed = { lastSeq: candidate.lastSeq };
            lastSeq = candidate.lastSeq;
            lastTs = candidate.lastTs ?? 0;
            break;
        }
        catch (error) {
            if (error instanceof InvalidSnapshotError) {
                invalidSnapshots.push({ lastSeq: candidate.lastSeq, reason: error.reason });
                continue;
            }
            const reason = candidate.version !== undefined && candidate.version !== 1
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
        book = new Engine(args.spec);
    }
    const regenerated = [];
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
    const firstChunkSeq = commands[0].seq;
    if (firstChunkSeq !== expectedFirst) {
        throw new JournalGapError(args.symbol, expectedFirst, firstChunkSeq);
    }
    const maxChunkSeq = commands[commands.length - 1].seq;
    const storedEvents = await args.journal.readEvents(args.symbol, firstChunkSeq, maxChunkSeq);
    const storedBySeq = new Map();
    for (const event of storedEvents) {
        const existing = storedBySeq.get(event.seq) ?? [];
        storedBySeq.set(event.seq, [...existing, event.payload]);
    }
    for (const commandRow of commands) {
        const expected = lastSeq + 1;
        if (commandRow.seq !== expected) {
            throw new JournalGapError(args.symbol, expected, commandRow.seq);
        }
        const generated = book.apply(commandRow.command);
        const storedForSeq = storedBySeq.get(commandRow.seq) ?? [];
        if (storedForSeq.length > 0) {
            const actual = generated;
            const expectedValue = storedForSeq;
            if (canonicalJson(expectedValue) !== canonicalJson(actual)) {
                throw new ReplayMismatchError(args.symbol, commandRow.seq, expectedValue, actual, readableMismatch(expectedValue, actual));
            }
            verified += 1;
        }
        else {
            regenerated.push({
                symbol: args.symbol,
                seq: commandRow.seq,
                ts: commandRow.ts,
                command: commandRow.command,
                events: generated,
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
export async function recoverShard(args) {
    const results = [];
    const regenerated = [];
    const streams = new Map();
    const lastSeqBySymbol = new Map();
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
            streams: new Map(streams),
            lastSeqBySymbol: new Map(lastSeqBySymbol),
            lastTs,
        },
        regenerated,
        results,
    };
}
