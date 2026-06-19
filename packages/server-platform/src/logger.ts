import { pino, type Logger as PinoLogger } from "pino";

type Logger = PinoLogger;

type CreateLoggerInput = {
  pretty: boolean;
};

function createLogger(input: CreateLoggerInput): Logger {
  if (input.pretty) {
    return pino({
      level: "info",
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    });
  }
  return pino({ level: "info" });
}

export { createLogger };
export type { Logger };
