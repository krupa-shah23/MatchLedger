/**
 * Fastify app factory.
 * Composes plugins, middleware, and routes.
 */

import Fastify from "fastify";
import type { FastifyInstance, FastifyRequest } from "fastify";
import websocketPlugin from "@fastify/websocket";
import multipartPlugin from "@fastify/multipart";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerMarketRoutes } from "./routes/market.js";
import { registerAccountRoutes } from "./routes/accounts.js";
import { registerRiskRoutes } from "./routes/risk.js";
import { registerReconRoutes, RECON_UPLOAD_LIMIT_BYTES } from "./routes/recon.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerSystemRoutes } from "./routes/system.js";
import { registerWebSocketGateway } from "./ws/gateway.js";
import { Hub } from "./ws/hub.js";
import { registerRequestContextPlugin, requireRole } from "./plugins/request-context.js";
import { ENDPOINT_ROLES, formatMinor, type RiskConfig } from "@matchledger/common";
import { signToken } from "./auth/tokens.js";
import { RateLimiter } from "./plugins/rate-limit.js";
import type { Config } from "./config.js";
import type { SqlExecutor } from "@matchledger/projections";
import type { RuntimeFacade } from "./orders/submit.js";
import type { CommandRouterConfig } from "./routes/admin.js";

export interface AppDeps {
  config: Config;
  executor: SqlExecutor;
  facade: RuntimeFacade;
  instruments: Array<{ symbol: string; tick: string; lot: string; spec?: any }>;
  simulatorState?: { current: any | null };
  commandRouter?: CommandRouterConfig;
  riskConfig?: RiskConfig;
  heartbeatMs?: number;
  prometheusUrl?: string;
  simulatorRateCap?: number;
  simulatorTicksPerSec?: number;
  simulatorUserId?: string;
  orderRateLimiter?: RateLimiter;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  // Allow the 20 MiB statement plus multipart framing so the streamed route
  // can return its own 413 response at the documented file-size boundary.
  const app = Fastify({ logger: false, bodyLimit: RECON_UPLOAD_LIMIT_BYTES + 1024 * 1024 });
  const hub = new Hub();
  const orderRateLimiter = deps.orderRateLimiter ?? new RateLimiter({
    tokensPerSecond: deps.config.RATE_LIMIT_ORDERS_PER_SEC,
    burstSize: deps.config.RATE_LIMIT_BURST,
  });

  // Register plugins
  await app.register(websocketPlugin);
  await app.register(multipartPlugin);
  await registerRequestContextPlugin(app, deps.config, deps.executor);
  app.addHook("preHandler", async (request, reply) => {
    const route = request.routeOptions.url;
    if (!route || route === "/ws" || route === "/auth/login" || route === "/auth/refresh") return;
    const normalized = route.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    const roles = ENDPOINT_ROLES[`${request.method} ${normalized}`];
    if (roles) {
      await requireRole(...roles)(request, reply);
      if (reply.sent) return;
    }
    if (request.method === "POST" && route === "/orders") {
      const user = (request as FastifyRequest & { user?: { accountIds?: string[] } }).user;
      const accountId = user?.accountIds?.[0];
      if (accountId) {
        const retryMs = orderRateLimiter.tryConsume(accountId);
        if (retryMs > 0) {
          return reply.header("Retry-After", String(Math.ceil(retryMs / 1000))).status(429)
            .type("application/problem+json").send({
              type: "about:blank#rate_limited",
              title: "Too many orders",
              status: 429,
              code: "rate_limited",
              detail: "Order rate limit exceeded",
              instance: request.url,
              requestId: request.id,
            });
        }
      }
    }
  });

  // Register WebSocket gateway first (before other routes)
  await registerWebSocketGateway(app, { hub, config: deps.config, snapshot: async (topic, token) => {
    const paths: Record<string, string> = { "user.orders": "/orders", breaker: "/status", "risk.rejections": "/risk/rejections", system: "/system/shards" };
    const path = topic.startsWith("book.") ? `/symbols/${encodeURIComponent(topic.slice(5))}/book`
      : topic.startsWith("trades.") ? `/trades?symbol=${encodeURIComponent(topic.slice(7))}` : paths[topic];
    if (!path) throw new Error("Unknown topic");
    const response = await app.inject({ method: "GET", url: path, headers: { authorization: `Bearer ${token}` } });
    if (response.statusCode !== 200) throw new Error("Snapshot refused");
    const body = response.json();
    if (topic === "user.orders") return body.orders.map((o: { orderId: string }) => ({ ...o, id: o.orderId }));
    if (topic.startsWith("book.")) return { bids: body.bid.map((b: { price: string; quantity: string }) => [b.price, b.quantity]), asks: body.ask.map((a: { price: string; quantity: string }) => [a.price, a.quantity]) };
    return body;
  } });

  // Register HTTP routes with dependencies
  await registerAuthRoutes(app, { executor: deps.executor, config: deps.config });
  await registerOrderRoutes(app, { executor: deps.executor, facade: deps.facade });
  await registerMarketRoutes(app, { executor: deps.executor, instruments: deps.instruments });
  await registerAccountRoutes(app, { executor: deps.executor });
  await registerRiskRoutes(app, { executor: deps.executor, facade: deps.facade });
  await registerReconRoutes(app, { executor: deps.executor });
  await registerAdminRoutes(app, {
    executor: deps.executor,
    facade: deps.facade,
    isDemo: deps.config.PROFILE === "demo",
    commandRouter: deps.commandRouter,
    simulatorState: deps.simulatorState,
  });
  await registerSystemRoutes(app, {
    chaosEnabled: deps.config.PROFILE === "demo" && Boolean(deps.commandRouter),
    executor: deps.executor,
    facade: deps.facade,
    isDemo: deps.config.PROFILE === "demo",
    instruments: deps.instruments,
    simulatorState: deps.simulatorState,
    riskConfig: deps.riskConfig,
    heartbeatMs: deps.heartbeatMs,
    prometheusUrl: deps.prometheusUrl,
    simulatorRateCap: deps.simulatorRateCap,
    simulatorTicksPerSec: deps.simulatorTicksPerSec,
    submitSimulatorOrder: async order => {
      const token = await signToken({ secret: new TextEncoder().encode(deps.config.JWT_SECRET), ttlSeconds: deps.config.JWT_TTL_SECONDS }, deps.simulatorUserId ?? "demo-simulator", "TRADER");
      const response = await app.inject({ method: "POST", url: "/orders",
        headers: { authorization: `Bearer ${token}` }, payload: {
          clientOrderId: order.clientOrderId, symbol: order.symbol, side: order.side,
          type: order.type, timeInForce: order.type === "MARKET" ? "IOC" : "GTC",
          quantity: order.quantity.toString(), price: order.price === null ? undefined : formatMinor(order.price, deps.config.PRICE_DECIMALS),
        } });
      if (response.statusCode === 202) return "ACCEPTED";
      if (response.statusCode === 503 || response.statusCode === 429) return 503;
      throw new Error(`Simulator order refused: ${response.statusCode}`);
    },
  });

  return app;
}
