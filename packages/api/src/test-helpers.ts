/**
 * Test helpers for API route testing
 * Provides mock implementations of SqlExecutor, RuntimeFacade, and Config
 */

import type { FastifyInstance } from "fastify";
import * as jose from "jose";
import type { SqlExecutor, RuntimeFacade } from "@matchledger/projections";
import type { Config } from "./config.js";
import type { RateLimiter } from "./plugins/rate-limit.js";
import { buildApp } from "./app.js";

/**
 * Mock SqlExecutor for testing
 * Stores data in-memory maps for test scenarios
 */
export class MockSqlExecutor implements SqlExecutor {
  public tables: Record<string, unknown[]> = {
    order_requests: [],
    orders_view: [],
    balances_view: [],
    users: [],
    user_accounts: [],
    recon_breaks: [],
    recon_audit: [],
  };
  private transactionDepth = 0;

  async query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }> {
    if (sql.includes("SELECT status") && sql.includes("FROM recon_breaks")) {
      const row = (this.tables.recon_breaks as any[]).find((entry) => entry.break_id === params[0]);
      return { rows: row ? [{ status: row.status, resolved_by: row.resolved_by ?? null }] : [] };
    }
    if (sql.includes("UPDATE recon_breaks")) {
      const [id, ...rest] = params as string[];
      const row = (this.tables.recon_breaks as any[]).find((entry) => entry.break_id === id);
      if (!row || (sql.includes("status IN") && !["OPEN", "INVESTIGATING"].includes(row.status)) || (sql.includes("status = $4") && row.status !== rest[2])) return { rows: [] };
      if (sql.includes("status='RESOLVED'")) {
        row.status = "RESOLVED";
        row.reason = rest[0];
        row.resolved_by = rest[1];
      } else {
        row.status = rest[0];
        row.reason = rest[1];
      }
      return { rows: [{ break_id: id }] };
    }
    if (sql.includes("INSERT INTO recon_audit")) {
      (this.tables.recon_audit as unknown[]).push({ params });
      return { rows: [] };
    }
    if (sql.includes("SELECT account_id FROM user_accounts WHERE user_id = $1")) {
      return { rows: (this.tables.user_accounts ?? []).filter((row: any) => row.user_id === params[0]) };
    }
    if (sql.includes("SELECT account_id FROM user_accounts WHERE account_id = $1")) {
      return { rows: (this.tables.user_accounts ?? []).filter((row: any) => row.account_id === params[0]) };
    }
    if (sql.includes("SELECT DISTINCT account_id AS id") && sql.includes("FROM user_accounts")) {
      const uniqueAccounts = new Set((this.tables.user_accounts ?? []).map((row: any) => row.account_id));
      return { rows: [...uniqueAccounts].sort().map((accountId) => ({ id: accountId, name: accountId })) };
    }
    if (sql.includes("INSERT INTO user_accounts")) {
      const [userId, accountId] = params as [string, string];
      const links = this.tables.user_accounts ?? (this.tables.user_accounts = []);
      if ((links as any[]).some((row) => row.account_id === accountId)) {
        throw new Error('duplicate key value violates unique constraint "user_accounts_account_id_key" (UNIQUE)');
      }
      (links as unknown[]).push({ user_id: userId, account_id: accountId });
      return { rows: [] };
    }
    if (sql.includes("SELECT") && sql.includes("FROM order_requests WHERE order_id = $1")) {
      return { rows: (this.tables.order_requests ?? []).filter((r: any) => r.order_id === params[0]) };
    }
    // INSERT INTO users - simulates the real UNIQUE(username) constraint so
    // tests can exercise the 409-on-duplicate-username path for real.
    if (sql.includes("INSERT INTO users")) {
      const [, username] = params as [string, string, string, string];
      if ((this.tables.users as any[]).some((u) => u.username === username)) {
        throw new Error('duplicate key value violates unique constraint "users_username_key" (UNIQUE)');
      }
      (this.tables.users as any[]).push({ username });
      return { rows: [] };
    }

    // INSERT INTO order_requests
    if (sql.includes("INSERT INTO order_requests")) {
      const [accountId, clientOrderId, payloadHash, orderId] = params as [
        string,
        string,
        string,
        string,
      ];
      const existing = (this.tables.order_requests as any[]).find(
        (r) => r.account_id === accountId && r.client_order_id === clientOrderId
      );

      if (existing) {
        // ON CONFLICT - check if hash matches
        if (existing.payload_hash !== payloadHash) {
          throw new Error("CONFLICT_DIFFERENT_PAYLOAD");
        }
        return { rows: [existing] };
      }

      const row = { account_id: accountId, client_order_id: clientOrderId, payload_hash: payloadHash, order_id: orderId };
      (this.tables.order_requests as unknown[]).push(row);
      return { rows: [row] };
    }

    // SELECT WHERE account_id = $1 ORDER BY created_at DESC (pagination)
    if (sql.includes("SELECT") && sql.includes("orders_view") && sql.includes("account_id")) {
      const accountId = params[0] as string;
      const orders = (this.tables.orders_view as any[]).filter((o) => o.account_id === accountId);

      // Sort by created_at DESC
      orders.sort((a, b) => {
        const aTime = (a.created_at as Date).getTime();
        const bTime = (b.created_at as Date).getTime();
        return bTime - aTime;
      });

      // Handle LIMIT
      let limit = 50;
      const limitIdx = params.findIndex((p) => typeof p === "number");
      if (limitIdx >= 0) {
        limit = (params[limitIdx] as number) + 1; // +1 for hasMore check
      }

      return { rows: orders.slice(0, limit) };
    }

    // SELECT FROM orders_view by order_id
    if (sql.includes("SELECT") && sql.includes("orders_view WHERE order_id")) {
      const orderId = params[0] as string;
      const orders = (this.tables.orders_view as any[]).filter((o) => o.order_id === orderId);
      return { rows: orders };
    }

    // SELECT FROM balances_view
    if (sql.includes("SELECT") && sql.includes("balances_view")) {
      const accountId = params[0] as string;
      const balances = (this.tables.balances_view as any[]).filter((b) => b.account_id === accountId);
      return { rows: balances };
    }

    return { rows: [] };
  }

  async transaction<T>(fn: (executor: SqlExecutor) => Promise<T>): Promise<T> {
    this.transactionDepth++;
    try {
      return await fn(this);
    } finally {
      this.transactionDepth--;
    }
  }

  addOrder(order: any) {
    // Ensure all required fields are present
    const fullOrder = {
      order_id: order.order_id,
      account_id: order.account_id,
      client_order_id: order.client_order_id || null,
      symbol: order.symbol,
      side: order.side,
      order_type: order.order_type || order.type,
      quantity: order.quantity,
      price: order.price,
      effective_price: order.effective_price || null,
      filled_qty: order.filled_qty || 0n,
      accepted: order.accepted ?? false,
      rested: order.rested ?? false,
      cancel_requested: order.cancel_requested ?? false,
      terminal: order.terminal || null,
      terminal_reason: order.terminal_reason || null,
      created_at: order.created_at || new Date(),
      updated_at: order.updated_at || new Date(),
      time_in_force: order.time_in_force || "GTC",
      ...order, // Spread for any additional fields
    };
    (this.tables.orders_view as unknown[]).push(fullOrder);
  }

  addBalance(balance: any) {
    (this.tables.balances_view as unknown[]).push(balance);
  }

  reset() {
    this.tables.order_requests = [];
    this.tables.orders_view = [];
    this.tables.balances_view = [];
  }
}

/**
 * Mock RuntimeFacade for testing
 * Tracks method calls for verification
 */
export class MockRuntimeFacade implements RuntimeFacade {
  public calls: Array<{ method: string; args: unknown[] }> = [];
  private commands: Map<string, boolean> = new Map();

  async submitOrder(cmd: unknown): Promise<{ kind: "JOURNALED" | "FULL" }> {
    this.calls.push({ method: "submitOrder", args: [cmd] });
    this.recordCommand((cmd as { orderId: string }).orderId);
    return { kind: "JOURNALED" };
  }

  async hasSubmitCommand(orderId: string): Promise<boolean> {
    this.calls.push({ method: "hasSubmitCommand", args: [orderId] });
    return this.commands.get(orderId) ?? false;
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    this.calls.push({ method: "cancelOrder", args: [symbol, orderId] });
  }

  async haltSymbol(symbol: string, reason: string): Promise<void> {
    this.calls.push({ method: "haltSymbol", args: [symbol, reason] });
  }

  async resumeSymbol(symbol: string, reason?: string): Promise<void> {
    this.calls.push({ method: "resumeSymbol", args: [symbol, reason] });
  }

  async deposit(accountId: string, asset: string, amount: bigint, requestId: string): Promise<void> {
    this.calls.push({ method: "deposit", args: [accountId, asset, amount, requestId] });
  }

  async riskView(accountId: string): Promise<unknown> {
    this.calls.push({ method: "riskView", args: [accountId] });
    return {};
  }

  async internalTrades(fromTs: number, toTs: number): Promise<unknown[]> {
    this.calls.push({ method: "internalTrades", args: [fromTs, toTs] });
    return [];
  }

  recordCommand(orderId: string) {
    this.commands.set(orderId, true);
  }

  reset() {
    this.calls = [];
    this.commands.clear();
  }
}

/**
 * Build a test app with mock dependencies
 */
export async function buildTestApp(options: { orderRateLimiter?: RateLimiter } = {}): Promise<{
  app: FastifyInstance;
  executor: MockSqlExecutor;
  facade: MockRuntimeFacade;
}> {
  const executor = new MockSqlExecutor();
  const facade = new MockRuntimeFacade();
  const config: Config = {
    NODE_ENV: "development",
    PORT: 3000,
    METRICS_PORT: 3001,
    DATABASE_URL: "postgresql://test",
    JWT_SECRET: "test-secret-key-12345678901234567890",
    JWT_TTL_SECONDS: 900,
    SESSION_MAX_SECONDS: 28800,
    PROFILE: "prod",
    PRICE_DECIMALS: 2,
    RATE_LIMIT_ORDERS_PER_SEC: 10,
    RATE_LIMIT_BURST: 20,
    PROJECTOR_POLL_MS: 200,
    PROJECTOR_CHUNK: 1000,
  };

  const instruments = [
    { symbol: "ACME", tick: "0.01", lot: "1" },
    { symbol: "TECH", tick: "0.01", lot: "1" },
  ];

  const app = await buildApp({
    config,
    executor,
    facade,
    instruments,
    orderRateLimiter: options.orderRateLimiter,
  });

  // For testing, inject user context directly without full middleware
  // This simulates what the request-context middleware does
  app.addHook("preHandler", async (request) => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const secret = new TextEncoder().encode(config.JWT_SECRET);
        const verified = await jose.jwtVerify(token, secret, { algorithms: ["HS256"] });
        (request as any).user = {
          userId: verified.payload.sub,
          role: verified.payload.role as string,
          accountIds: (verified.payload.accountIds as string[]) || [],
          authTime: verified.payload.auth_time as number,
        };
      } catch (e) {
        // Token verification failed, user remains undefined
        // Routes will handle this with 401/403
      }
    }
  });

  return { app, executor, facade };
}

/**
 * Generate a test JWT token (async - must be awaited)
 */
export async function createTestToken(
  userId: string = "user-123",
  role: string = "TRADER",
  accountIds: string[] = ["acc1"]
): Promise<string> {
  const secret = new TextEncoder().encode("test-secret-key-12345678901234567890");
  const now = Math.floor(Date.now() / 1000);

  const jwt = new jose.SignJWT({
    sub: userId,
    role,
    accountIds,
    auth_time: now,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 900);

  return await jwt.sign(secret);
}
