import { z } from "zod";

/**
 * The environment a runtime boots into. Both the `service` and `worker` parse
 * their config through this schema at startup, so process env is validated once,
 * in one place, and the rest of the code receives a typed {@link AppConfig}
 * instead of reaching into `process.env`.
 *
 * `PORT` is coerced from its string env value to a number. `LOG_LEVEL` mirrors
 * pino's levels so {@link createLogger} can consume it directly.
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
 * Parse and validate process env into an {@link AppConfig}. Invalid or missing
 * config is an exceptional fault the runtime cannot recover from, not an
 * expected domain failure — so this **throws** (fail-fast at boot) rather than
 * returning a `Result`. The thrown error names every offending variable.
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
