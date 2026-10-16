import type { Readable } from "node:stream";
export declare function hashStatement(readable: Readable): Promise<string>;
export declare function streamRows(readable: Readable): Promise<{
    readonly rows: readonly string[][];
    readonly hash: string;
}>;
