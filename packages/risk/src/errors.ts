// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.

export class UnknownAccountError extends Error {
  public constructor(accountId: string) {
    super(`Unknown account: ${accountId}`);
    this.name = "UnknownAccountError";
  }
}

export class RiskFailedError extends Error {
  public constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = "RiskFailedError";
  }
}
