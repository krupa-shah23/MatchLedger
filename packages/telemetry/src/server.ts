/**
 * Metrics server serving /metrics and /healthz.
 * Minimal server, read-only endpoints only.
 */

import http from "node:http";
import { getRegistry } from "./registry.js";

export interface MetricsServerOptions {
  port?: number;
}

export async function startMetricsServer(opts: MetricsServerOptions = {}): Promise<http.Server> {
  const port = opts.port || 9090;
  const registry = getRegistry();

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url === "/metrics") {
          const metrics = await registry.metrics();
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(metrics);
        } else if (req.url === "/healthz") {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("ok");
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
        }
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Error: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    });

    server.listen(port, "127.0.0.1", () => {
      console.log(`[metrics] Server listening on http://127.0.0.1:${port}`);
      resolve(server);
    });

    server.on("error", reject);
  });
}
