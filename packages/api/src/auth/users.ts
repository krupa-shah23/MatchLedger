/**
 * User store backed by Postgres
 */

import type { ApiRole } from "@matchledger/common";

export interface SqlExecutor {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface User {
  user_id: string;
  username: string;
  password_hash: string;
  role: ApiRole;
  active: boolean;
}

/**
 * Get user by username
 */
export async function getUserByUsername(executor: SqlExecutor, username: string): Promise<User | null> {
  const result = await executor.query(
    "SELECT user_id, username, password_hash, role, active FROM users WHERE username = $1;",
    [username]
  );

  return (result.rows[0] as User | undefined) ?? null;
}

/**
 * Get user by ID
 */
export async function getUserById(executor: SqlExecutor, userId: string): Promise<User | null> {
  const result = await executor.query(
    "SELECT user_id, username, password_hash, role, active FROM users WHERE user_id = $1;",
    [userId]
  );

  return (result.rows[0] as User | undefined) ?? null;
}

/**
 * Get account IDs owned by a user
 */
export async function getUserAccounts(executor: SqlExecutor, userId: string): Promise<string[]> {
  const result = await executor.query(
    "SELECT account_id FROM user_accounts WHERE user_id = $1;",
    [userId]
  );

  return result.rows.map((r: any) => r.account_id) as string[];
}

/**
 * Check if a user owns an account
 */
export async function userOwnsAccount(
  executor: SqlExecutor,
  userId: string,
  accountId: string
): Promise<boolean> {
  const result = await executor.query(
    "SELECT 1 FROM user_accounts WHERE user_id = $1 AND account_id = $2;",
    [userId, accountId]
  );

  return result.rows.length > 0;
}
