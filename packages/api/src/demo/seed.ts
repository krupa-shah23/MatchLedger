import type { SqlExecutor } from "@matchledger/journal";
import { hashPassword } from "../auth/passwords.js";

/** Demo-profile bootstrap only. All funds enter through the durable runtime. */
export async function seedDemo(sql: SqlExecutor, runtime: { deposit(accountId: string, asset: string, amount: bigint, requestId: string): Promise<void> }, symbols: readonly string[]) {
  for (const [suffix, role] of [["trader", "TRADER"], ["risk", "RISK"], ["ops", "OPS"], ["admin", "ADMIN"], ["simulator", "TRADER"]] as const) {
    const requestedUserId = `demo-${suffix}`;
    const userResult = await sql.query(
      "INSERT INTO users (user_id,username,password_hash,role) VALUES ($1,$1,$2,$3) ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash, role=EXCLUDED.role RETURNING user_id",
      [requestedUserId, await hashPassword("demo-password"), role],
    );
    const userId = String(userResult.rows[0]?.user_id ?? requestedUserId);
    const existingAccount = await sql.query("SELECT account_id FROM user_accounts WHERE user_id=$1 ORDER BY account_id LIMIT 1", [userId]);
    const accountId = String(existingAccount.rows[0]?.account_id ?? `${requestedUserId}-account`);
    await sql.query("INSERT INTO user_accounts (user_id,account_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [userId, accountId]);
    if (role === "TRADER") {
      await runtime.deposit(accountId, "CASH", 1_000_000_000n, `seed:${accountId}:cash`);
      for (const symbol of symbols) await runtime.deposit(accountId, `SHARES:${symbol}`, 10_000n, `seed:${accountId}:${symbol}`);
    }
  }
}
