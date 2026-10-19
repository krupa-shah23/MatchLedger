/**
 * Configuration from environment variables with fail-fast validation
 */

import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  METRICS_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 bytes"),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  SESSION_MAX_SECONDS: z.coerce.number().int().positive().default(28800), // 8 hours
  PROFILE: z.enum(["demo", "prod"]).default("prod"),
  PRICE_DECIMALS: z.coerce.number().int().min(0).max(8).default(2),
  RATE_LIMIT_ORDERS_PER_SEC: z.coerce.number().positive().default(10),
  RATE_LIMIT_BURST: z.coerce.number().positive().default(20),
  PROJECTOR_POLL_MS: z.coerce.number().int().positive().default(200),
  PROJECTOR_CHUNK: z.coerce.number().int().positive().default(1000),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  ");
    throw new Error(`Configuration error:\n  ${errors}`);
  }

  return result.data;
}
