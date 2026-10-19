import { encodeMoney, decodeMoney } from "@matchledger/common";

export interface RedisLikeClient {
  set(key: string, value: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
}

export function encodeAndDecodeMoneyInMemory(amount: bigint): bigint {
  const encoded = encodeMoney(amount);
  return decodeMoney(encoded);
}

export async function storeAndLoadMoney(
  client: RedisLikeClient,
  key: string,
  amount: bigint
): Promise<bigint> {
  const encoded = encodeMoney(amount);
  await client.set(key, encoded);
  const raw = await client.get(key);
  if (raw === null) {
    throw new Error(`Key ${key} not found in Redis`);
  }
  return decodeMoney(raw);
}

// Re-export for API use
export { Projector } from "./projector.js";
export type { ProjectorDeps } from "./projector.js";
export { deriveOrderStatus } from "./order-facts.js";
export type { OrderFacts, OrderStatus } from "./order-facts.js";
export { mapRiskRecord, mapEngineRecord } from "./mappers.js";
export type { Mutation } from "./mappers.js";
export {
  getOrder,
  listOrders,
  getOrderTimeline,
  getBook,
  getTrades,
  getBalances,
  getPositions,
  getPnl,
  getReservations,
  getLedger,
  getRejections,
  getBreakers,
} from "./queries.js";

export interface SqlExecutor {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
  transaction<T>(fn: (executor: SqlExecutor) => Promise<T>): Promise<T>;
}

export interface RuntimeFacade {
  submitOrder(cmd: unknown): Promise<{ kind: string }>;
  hasSubmitCommand(orderId: string): Promise<boolean>;
  cancelOrder(symbol: string, orderId: string): Promise<void>;
  haltSymbol(symbol: string, reason: string): Promise<void>;
  resumeSymbol(symbol: string, reason?: string): Promise<void>;
  deposit(accountId: string, asset: string, amount: bigint, requestId: string): Promise<void>;
  riskView(accountId: string): Promise<unknown>;
  internalTrades(fromTs: number, toTs: number): Promise<unknown[]>;
}
