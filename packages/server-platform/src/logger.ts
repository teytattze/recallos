import { pino, type Logger as PinoLogger } from "pino";

import type { AppMetadataConfig } from "./app-metadata-config";

type Logger = PinoLogger;

type CreateLoggerInput = {
  config: AppMetadataConfig;
};

function createLogger(input: CreateLoggerInput): Logger {
  if (input.config.APP_ENV === "production") {
    return pino({ level: "info" });
  }
  return pino({
    level: "info",
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  });
}

export { createLogger };
export type { Logger };
