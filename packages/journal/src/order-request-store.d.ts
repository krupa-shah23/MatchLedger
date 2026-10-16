import type { Pool } from "pg";
export type OrderRequestResult = "CREATED" | "DUPLICATE" | "CONFLICT";
export declare class OrderRequestStore {
    private readonly pool;
    constructor(pool: Pool);
    register(accountId: string, clientOrderId: string, orderId: string, payloadJson: unknown): Promise<{
        result: OrderRequestResult;
        orderId: string;
    }>;
}
