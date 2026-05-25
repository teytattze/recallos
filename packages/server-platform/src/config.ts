import { z } from "zod";

/**
 * Parsed once at startup by both `service` and `worker`, so the rest of the
 * code receives a typed {@link AppConfig} instead of reaching into `process.env`.
 */
const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type AppConfig = z.infer<typeof configSchema>;

/**
 * Invalid or missing config is an unrecoverable fault, not an expected domain
 * failure — so this **throws** (fail-fast at boot) rather than returning a `Result`.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration: ${result.error.message}`,
    );
  }
  return result.data;
}
