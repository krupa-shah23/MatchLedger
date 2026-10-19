/**
 * Composition root: config -> pool -> migrations -> recover -> projector -> listen.
 */

import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const config = loadConfig();

  // TODO: Create database pool
  // TODO: Run migrations
  // TODO: Recover pipeline
  // TODO: Start projector
  // TODO: Start API server on config.PORT
  // TODO: Start metrics server on config.METRICS_PORT

  // Graceful shutdown
  let sigCount = 0;
  process.on("SIGTERM", async () => {
    sigCount++;
    if (sigCount === 1) {
      console.log("SIGTERM: shutting down gracefully...");
      // TODO: Close API, drain projector, stop pipeline, close pool
      process.exit(0);
    } else {
      console.log("SIGTERM again: forcing exit");
      process.exit(1);
    }
  });

  // Unhandled rejection / exception
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
    process.exit(1);
  });

  console.log(`API listening on port ${config.PORT}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
