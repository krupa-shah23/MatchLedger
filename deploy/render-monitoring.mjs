import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

// Keep monitoring private within this container; the Render web port belongs to the API.
const metricsPort = Number(process.env.METRICS_PORT ?? "3001");
if (!Number.isInteger(metricsPort) || metricsPort < 1 || metricsPort > 65535 || metricsPort === 9090) {
  throw new Error("METRICS_PORT must be a valid port distinct from 9090");
}
const configPath = "/tmp/matchledger-prometheus.yml";
await writeFile(configPath, `global:\n  scrape_interval: 5s\n  scrape_timeout: 4s\nscrape_configs:\n  - job_name: matchledger-api\n    static_configs:\n      - targets: [\"127.0.0.1:${metricsPort}\"]\n`);

const prometheus = spawn("prometheus", [
  `--config.file=${configPath}`,
  "--web.listen-address=127.0.0.1:9090",
  "--storage.tsdb.path=/tmp/matchledger-prometheus",
  "--storage.tsdb.retention.time=2h",
], { stdio: "inherit" });
const api = spawn(process.execPath, ["--max-old-space-size=384", "packages/api/dist/main.js"], {
  stdio: "inherit",
  env: { ...process.env, METRICS_HOST: "127.0.0.1", PROMETHEUS_URL: "http://127.0.0.1:9090" },
});

let stopping = false;
let failures = false;
const alive = new Set([prometheus, api]);
function stop(failed = false) {
  failures ||= failed;
  if (stopping) return;
  stopping = true;
  for (const child of alive) child.kill("SIGTERM");
  const timer = setTimeout(() => { for (const child of alive) child.kill("SIGKILL"); }, 30000);
  timer.unref();
}
for (const child of [prometheus, api]) {
  child.on("error", error => { console.error("Render service process failed:", error.message); alive.delete(child); stop(true); if (!alive.size) process.exitCode = 1; });
  child.on("exit", (code, signal) => {
    alive.delete(child);
    if (!stopping) { console.error(`Render service process exited: ${code ?? signal}`); stop(true); }
    if (!alive.size) process.exitCode = failures ? 1 : 0;
  });
}
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
