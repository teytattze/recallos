import convict, { type Schema } from "convict";

import localProfile from "../config/local.json";
import productionProfile from "../config/production.json";
import stagingProfile from "../config/staging.json";

const appEnvironmentSchema = z.enum(["local", "staging", "production"]);
const requiredStringSchema = z.string().trim().min(1);
const portSchema = z.number().int().min(1).max(65_535);

    environment: appEnvironmentSchema,
    version: requiredStringSchema,
      port: portSchema,
    }),
  }),
  ingestion: z.object({
    mongodb: z.object({
      url: requiredStringSchema,
      databaseName: requiredStringSchema,
type ServerApiConfig = ReadonlyDeep<z.infer<typeof serverApiConfigSchema>>;
const convictConfigSchema: Schema<ServerApiConfig> = {
      format: appEnvironmentSchema.options,
      format: (value) =>
        serverApiConfigSchema.shape.app.shape.version.parse(value),
        format: (value) =>
          serverApiConfigSchema.shape.app.shape.http.shape.port.parse(value),
        format: (value) =>
          serverApiConfigSchema.shape.ingestion.shape.mongodb.shape.url.parse(
            value,
          ),
        format: (value) =>
          serverApiConfigSchema.shape.ingestion.shape.mongodb.shape.databaseName.parse(
            value,
          ),
  const config = convict(convictConfigSchema, {
    env: options.env ?? process.env,
  });
  }
  return serverApiConfigSchema.parse(config.getProperties());

export { convictConfigSchema, createConfig, serverApiConfigSchema };
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
