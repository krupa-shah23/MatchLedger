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
