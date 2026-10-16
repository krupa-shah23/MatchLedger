export function txIdForDeposit(requestId: string): string {
  return `dep:${requestId}`;
}

export function txIdForTrade(tradeId: string): string {
  return `trade:${tradeId}`;
}

export function txIdForAdjustment(adjustmentId: string): string {
  return `adj:${adjustmentId}`;
}

export function txIdForReversal(txId: string): string {
  return `rev:${txId}`;
}
