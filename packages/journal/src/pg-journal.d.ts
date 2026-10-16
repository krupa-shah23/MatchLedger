import type { Pool } from "pg";
import type { JournalAppender, JournalReader, ShardOutput } from "@matchledger/common";
export declare class JournalSequenceError extends Error {
    constructor(msg: string);
}
export declare class JournalConflictError extends Error {
    constructor(msg: string);
}
export declare class PgJournal implements JournalAppender, JournalReader {
    private readonly pool;
    readonly writerEpoch: number;
    constructor(pool: Pool, writerEpoch: number);
    append(batch: readonly unknown[]): Promise<void>;
    appendEvents(batch: readonly ShardOutput[]): Promise<void>;
    lastCommandSeq(symbol: string): Promise<number>;
    readCommands(symbol: string, fromSeq: number, chunkSize: number): Promise<readonly {
        seq: number;
        ts: number;
        command: unknown;
    }[]>;
    readEvents(symbol: string, fromSeq: number, toSeq: number): Promise<readonly {
        seq: number;
        ts: number;
        payload: unknown;
    }[]>;
}
