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
import { registerWebSocketGateway } from "./ws/gateway.js";
import type { Config } from "./config.js";
import type { SqlExecutor } from "@matchledger/projections";
import type { RuntimeFacade } from "./orders/submit.js";

export interface AppDeps {
  config: Config;
  executor: SqlExecutor;
  facade: RuntimeFacade;
  instruments: Array<{ symbol: string; tick: string; lot: string }>;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Register plugins
  await app.register(websocketPlugin);
  await app.register(multipartPlugin);

  // Register WebSocket gateway first (before other routes)
  await registerWebSocketGateway(app);

  // Register HTTP routes with dependencies
  await registerAuthRoutes(app, { executor: deps.executor, config: deps.config });
  await registerOrderRoutes(app, { executor: deps.executor, facade: deps.facade });
  await registerMarketRoutes(app, { executor: deps.executor, instruments: deps.instruments });
  await registerAccountRoutes(app, { executor: deps.executor });
  await registerRiskRoutes(app, { executor: deps.executor, facade: deps.facade });
  await registerReconRoutes(app, { executor: deps.executor });
  await registerAdminRoutes(app, { executor: deps.executor, facade: deps.facade });
  await registerSystemRoutes(app, { executor: deps.executor, facade: deps.facade });

  return app;
}
