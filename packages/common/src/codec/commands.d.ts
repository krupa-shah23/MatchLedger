import type { Command } from "@matchledger/engine-core";
export declare function serializeCommand(cmd: unknown): string;
export declare function deserializeCommand(json: string): Command;
