import { Pool } from "pg";

const INT8_OID = 20;

export function createPool(config: { connectionString: string }): Pool {
  const pool = new Pool({ connectionString: config.connectionString });

  pool.on("connect", (client) => {
    client.setTypeParser(INT8_OID, (value) => {
      const num = Number(value);
      if (!Number.isSafeInteger(num)) throw new Error(`unsafe int8: ${value}`);
      return num;
    });
  });

  return pool;
}

export function toSafeNumber(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`unsafe number: ${value}`);
    return value;
  }
  if (typeof value === "string") {
    const num = Number(value);
    if (!Number.isSafeInteger(num)) throw new Error(`unsafe int8: ${value}`);
    return num;
  }
  throw new Error(`invalid number type: ${typeof value}`);
}
