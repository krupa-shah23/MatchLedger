import type { BookSnapshot } from "@matchledger/engine-core";
export declare function serializeBookSnapshot(snap: BookSnapshot): string;
export declare function deserializeBookSnapshot(json: string): BookSnapshot;
