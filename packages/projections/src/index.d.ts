export interface RedisLikeClient {
    set(key: string, value: string): Promise<unknown>;
    get(key: string): Promise<string | null>;
}
export declare function encodeAndDecodeMoneyInMemory(amount: bigint): bigint;
export declare function storeAndLoadMoney(client: RedisLikeClient, key: string, amount: bigint): Promise<bigint>;
