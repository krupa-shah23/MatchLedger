/**
 * Fastify app factory.
 * Composes plugins, middleware, and routes.
 */

import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import multipartPlugin from "@fastify/multipart";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerMarketRoutes } from "./routes/market.js";
import { registerAccountRoutes } from "./routes/accounts.js";
import { registerRiskRoutes } from "./routes/risk.js";
import { registerReconRoutes } from "./routes/recon.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerSystemRoutes } from "./routes/system.js";

export interface AppDeps {
  jwtSecret: string;
  metricsPort: number;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Register plugins
  await app.register(websocketPlugin);
  await app.register(multipartPlugin);

  // Register routes
  await registerAuthRoutes(app);
  await registerOrderRoutes(app);
  await registerMarketRoutes(app);
  await registerAccountRoutes(app);
  await registerRiskRoutes(app);
  await registerReconRoutes(app);
  await registerAdminRoutes(app);
  await registerSystemRoutes(app);

  return app;
}
