import convict, { type Schema } from "convict";

import localProfile from "../config/local.json";
import productionProfile from "../config/production.json";
import stagingProfile from "../config/staging.json";

type AppEnvironment = "local" | "staging" | "production";

type ServerApiConfig = {
  readonly app: {
    readonly environment: AppEnvironment;
    readonly version: string;
    readonly http: {
      readonly port: number;
    };
  };
  readonly ingestion: {
    readonly mongodb: {
      readonly url: string;
      readonly databaseName: string;
    };
  };
};

const requiredString = (value: unknown): asserts value is string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("must be a non-empty string");
  }
};

const positivePort = (value: unknown): asserts value is number => {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 65_535
  ) {
    throw new Error("must be an integer between 1 and 65535");
  }
};

const configSchema: Schema<ServerApiConfig> = {
  app: {
    environment: {
      doc: "Application deployment environment",
      format: ["local", "staging", "production"],
      default: "local",
      env: "APP_ENV",
    },
    version: {
      doc: "Application version",
      format: String,
      default: "0.0.0",
      env: "APP_VERSION",
    },
    http: {
      port: {
        doc: "HTTP port",
        format: positivePort,
        default: 8000,
        env: "HTTP_PORT",
      },
    },
  },
  ingestion: {
    mongodb: {
      url: {
        doc: "Ingestion MongoDB connection URL",
        format: requiredString,
        default: null,
        env: "INGESTION_MONGODB_URL",
      },
      databaseName: {
        doc: "Ingestion MongoDB database name",
        format: requiredString,
        default: null,
        env: "INGESTION_MONGODB_DATABASE_NAME",
      },
    },
  },
};

const profiles = {
  local: localProfile,
  staging: stagingProfile,
  production: productionProfile,
} as const;

type CreateConfigOptions = {
  readonly env?: NodeJS.ProcessEnv;
};

const createConfig = (options: CreateConfigOptions = {}): ServerApiConfig => {
  const config = convict(configSchema, { env: options.env ?? process.env });
  const environment = config.get("app.environment");

  if (!Object.hasOwn(profiles, environment)) {
    throw new Error(`Unsupported APP_ENV: ${String(environment)}`);
  }

  config.load(profiles[environment]);
  config.validate({ allowed: "strict" });

  return config.getProperties();
};

export { configSchema, createConfig };
export type { ServerApiConfig };
