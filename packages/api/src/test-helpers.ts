/**
 * Test helpers for API route testing
 * Provides mock implementations of SqlExecutor, RuntimeFacade, and Config
 */

import type { FastifyInstance } from "fastify";
import * as jose from "jose";
import type { SqlExecutor, RuntimeFacade } from "@matchledger/projections";
import type { Config } from "./config.js";
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
  };
  private transactionDepth = 0;

  async query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }> {
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
export async function buildTestApp(): Promise<{
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
