import { pino, type Logger as PinoLogger } from "pino";

import type { Config } from "./config.ts";

type Logger = PinoLogger;

function createLogger(config: Pick<Config, "NODE_ENV" | "LOG_LEVEL">): Logger {
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

export { createLogger };
export type { Logger };
