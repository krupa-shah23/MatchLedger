import type { RiskCommand } from "../risk-types.js";
export declare function serializeRiskCommand(cmd: RiskCommand): string;
export declare function deserializeRiskCommand(json: string): RiskCommand;
