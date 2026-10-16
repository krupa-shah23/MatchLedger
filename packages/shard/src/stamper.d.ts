import type { Clock, StampedCommand } from "@matchledger/common";
import type { Command as EngineCommand } from "@matchledger/engine-core";
export declare class Stamper {
    private readonly clock;
    private lastTs;
    private readonly seqBySymbol;
    constructor(clock: Clock);
    restore(seqBySymbol: ReadonlyMap<string, number>, lastTs: number): void;
    stamp(symbol: string, command: EngineCommand): StampedCommand;
}
