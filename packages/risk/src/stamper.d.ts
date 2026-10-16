import type { Clock, RiskCommand, StampedRiskCommand } from "@matchledger/common";
export declare class RiskStamper {
    private readonly clock;
    private readonly lastTs;
    private readonly lastSeq;
    constructor(clock: Clock);
    stamp(partition: number, command: RiskCommand): StampedRiskCommand;
}
