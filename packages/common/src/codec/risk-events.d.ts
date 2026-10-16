import type { RiskEvent } from "../risk-types.js";
export declare function serializeRiskEvent(evt: RiskEvent): string;
export declare function deserializeRiskEvent(json: string): RiskEvent;
