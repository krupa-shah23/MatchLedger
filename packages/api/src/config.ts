/**
 * Configuration from environment.
 * Fail fast with readable list of missing/invalid vars.
 */

import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  METRICS_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  SESSION_MAX_SECONDS: z.coerce.number().int().positive().default(28800),
  PROFILE: z.enum(["demo", "prod"]).default("prod"),
  PRICE_DECIMALS: z.coerce.number().int().min(0).max(8).default(2),
  RATE_LIMIT_ORDERS_PER_SEC: z.coerce.number().positive().default(10),
  RATE_LIMIT_BURST: z.coerce.number().positive().default(50),
  PROJECTOR_POLL_MS: z.coerce.number().positive().default(200),
  PROJECTOR_CHUNK: z.coerce.number().positive().default(1000),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  try {
    return ConfigSchema.parse(process.env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
      throw new Error(`Config validation failed:\n${messages.join("\n")}`);
    }
    throw err;
  }
}
