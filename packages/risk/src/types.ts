// PROTOTYPE (Week 4). Replaced by the real reservation stage in Week 7.

export type AccountState = {
  readonly cash: bigint;
  readonly held: bigint;
};

export type ReserveRequest = {
  readonly accountId: string;
  readonly orderId: string;
  readonly need: bigint;
};

export type ReserveResult = {
  readonly orderId: string;
  readonly accepted: boolean;
  readonly reason?: "INSUFFICIENT_BALANCE" | "INVALID_AMOUNT";
};

export type RiskHooks = {
  readonly onHandlerStart?: (request: ReserveRequest) => void;
  readonly onHandlerEnd?: (request: ReserveRequest) => void;
};
