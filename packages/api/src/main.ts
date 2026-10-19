/**
 * Composition root for HTTP API server
 *
 * Startup sequence:
 * 1. Load config
 * 2. Create database pool
 * 3. Run migrations
 * 4. Recover pipeline (fatal on error)
 * 5. Projector catch-up
 * 6. Start HTTP server
 * 7. Start metrics server (separate port)
 *
 * Graceful shutdown:
 * - SIGTERM: close WebSocket sockets (1001), drain projector, stop pipeline
 * - Second SIGTERM: force exit
 * - Unhandled rejection/exception: log then exit
 */

import * as process from "process";
import { loadConfig } from "./config.js";
import type { Config } from "./config.js";

let shutdownInitiated = false;

async function main(): Promise<void> {
  const cfg = loadConfig();

  // TODO: 1. Create pool from cfg
  // const pool = new Pool(cfg.DATABASE_URL);

  // TODO: 2. Run migrations
  // await migrate(pool, { migrationsDir: "./src/migrations" });

  // TODO: 3. Recover pipeline (fatal on error)
  // const runtime = await recoverPipeline(pool, cfg);
  // const pipeline = runtime.pipeline;

  // TODO: 4. Projector catch-up
  // const projector = new Projector(pool, cfg);
  // projector.start();
  // await projector.once("ready");

  // TODO: 5. Create HTTP server
  // const app = buildApp(runtime, projector, pool, cfg);
  // await app.listen({ port: cfg.PORT, host: "0.0.0.0" });
  // console.log(`API server listening on port ${cfg.PORT}`);

  // TODO: 6. Start metrics server (separate port)
  // const metricsApp = buildMetricsServer(projector, pool);
  // await metricsApp.listen({ port: cfg.METRICS_PORT, host: "0.0.0.0" });
  // console.log(`Metrics server listening on port ${cfg.METRICS_PORT}`);

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    if (shutdownInitiated) {
      console.error("Forcing exit");
      process.exit(1);
    }
    shutdownInitiated = true;
    console.log(`${signal} received, initiating graceful shutdown...`);

    // TODO: close WebSocket sockets with 1001
    // await app.close();

    // TODO: drain projector
    // await projector.stop();

    // TODO: stop pipeline
    // await pipeline.stop();

    // TODO: close database pool
    // await pool.end();

    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  process.on("unhandledRejection", (err) => {
    console.error("Unhandled rejection:", err);
    process.exit(1);
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
