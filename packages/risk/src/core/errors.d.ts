export declare class RiskInvariantError extends Error {
    readonly code: "FILL_EXCEEDS_REMAINING" | "PRICE_ABOVE_CAP" | "PRICE_BELOW_FLOOR" | "CLOSE_REMAINING_MISMATCH" | "INTERNAL";
    constructor(code: RiskInvariantError["code"], message: string);
}
export declare class InvalidRiskStateError extends Error {
    readonly reason: "VERSION" | "CONFIG_MISMATCH" | "DUPLICATE_RESERVATION" | "UNKNOWN_ACCOUNT" | "RESERVATION_NOT_DECIDED" | "AMOUNT_MISMATCH" | "HELD_MISMATCH" | "OVER_HELD" | "NEGATIVE" | "INVARIANT";
    constructor(reason: InvalidRiskStateError["reason"], message: string);
}
