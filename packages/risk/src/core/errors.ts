export class RiskInvariantError extends Error {
  public readonly code:
    | "FILL_EXCEEDS_REMAINING"
    | "PRICE_ABOVE_CAP"
    | "PRICE_BELOW_FLOOR"
    | "CLOSE_REMAINING_MISMATCH"
    | "INTERNAL";

  public constructor(code: RiskInvariantError["code"], message: string) {
    super(message);
    this.name = "RiskInvariantError";
    this.code = code;
  }
}

export class InvalidRiskStateError extends Error {
  public readonly reason:
    | "VERSION"
    | "CONFIG_MISMATCH"
    | "DUPLICATE_RESERVATION"
    | "UNKNOWN_ACCOUNT"
    | "RESERVATION_NOT_DECIDED"
    | "AMOUNT_MISMATCH"
    | "HELD_MISMATCH"
    | "OVER_HELD"
    | "NEGATIVE"
    | "INVARIANT";

  public constructor(reason: InvalidRiskStateError["reason"], message: string) {
    super(message);
    this.name = "InvalidRiskStateError";
    this.reason = reason;
  }
}
