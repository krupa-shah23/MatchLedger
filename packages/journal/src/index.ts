import { Client, types } from "pg";
types.setTypeParser(20, (value) => BigInt(value));
export async function verifyInt8RoundTrip(connectionString: string, value: bigint): Promise<bigint> { const client=new Client({connectionString}); await client.connect(); try { const result=await client.query<{value: bigint}>("SELECT $1::bigint AS value", [value.toString()]); return result.rows[0]!.value; } finally { await client.end(); } }
