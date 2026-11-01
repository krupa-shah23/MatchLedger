import { z } from "zod";

const positiveBigint = z.string().regex(/^[1-9][0-9]*$/).transform(BigInt);
const instrument = z.object({ symbol: z.string().regex(/^[A-Z][A-Z0-9_-]{0,31}$/),
  tickSize: positiveBigint, lotSize: positiveBigint, maxQuantity: positiveBigint, maxPrice: positiveBigint });
const defaults = ["ACME", "BOBO"].map(symbol => ({ symbol, tickSize: "1", lotSize: "1", maxQuantity: "1000000", maxPrice: "1000000" }));
export function loadStartupConfig(env: NodeJS.ProcessEnv = process.env) {
  const settings = z.object({
    DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    API_STARTUP_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
    TRANSPORT: z.enum(["inproc", "kafka"]).default("inproc"),
    KAFKA_BROKERS: z.string().min(1).default("localhost:29092"),
    SHARD_PARTITIONS: z.coerce.number().int().positive().default(4),
    METRICS_HOST: z.string().default("0.0.0.0"),
    HEARTBEAT_MS: z.coerce.number().int().positive().default(5000),
    QUEUE_CAPACITY: z.coerce.number().int().positive().default(1000),
    MAX_BATCH: z.coerce.number().int().positive().default(100),
    SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(30000),
    REBUILD_PROJECTIONS: z.enum(["0", "1"]).default("0"),
    SEED_DEMO: z.enum(["0", "1"]).default("0"),
    PROMETHEUS_URL: z.string().url().default("http://localhost:9090"),
    SIMULATOR_RATE_CAP: z.coerce.number().int().positive().max(1000).default(10),
    SIMULATOR_TICKS_PER_SEC: z.coerce.number().int().positive().max(100).default(10),
  }).parse(env);
  const instruments = z.array(instrument).min(1).parse(env.INSTRUMENTS_JSON ? JSON.parse(env.INSTRUMENTS_JSON) : defaults);
  if (new Set(instruments.map(i => i.symbol)).size !== instruments.length) throw new Error("Duplicate instrument symbol");
  return { ...settings, instruments };
}
