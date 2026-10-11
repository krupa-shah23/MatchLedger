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
