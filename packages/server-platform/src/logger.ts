import { pino, type Logger as PinoLogger } from "pino";

import type { AppConfig } from "./config.ts";

export type Logger = PinoLogger;

/**
 * Build the application logger. JSON to stdout in production (so log shippers can
 * parse it); human-readable via the `pino-pretty` transport everywhere else.
 * The level comes from {@link AppConfig.LOG_LEVEL}.
 *
 * A logger is infrastructure — the pure core never imports this. Adapters and
 * apps receive a `Logger` from the composition root.
 */
export function createLogger(
  config: Pick<AppConfig, "NODE_ENV" | "LOG_LEVEL">,
): Logger {
  if (config.NODE_ENV === "production") {
    return pino({ level: config.LOG_LEVEL });
  }

  return pino({
    level: config.LOG_LEVEL,
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  });
}
