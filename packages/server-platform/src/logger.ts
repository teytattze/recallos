import { pino, type Logger as PinoLogger } from "pino";

import type { AppConfig } from "./config.ts";

export type Logger = PinoLogger;

/**
 * JSON to stdout in production so log shippers can parse it; `pino-pretty`
 * everywhere else.
 *
 * A logger is infrastructure — the pure core never imports it; adapters and
 * apps receive one from the composition root.
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
