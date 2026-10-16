import { Pool } from "pg";
export declare function createPool(config: {
    connectionString: string;
}): Pool;
export declare function toSafeNumber(value: unknown): number;
