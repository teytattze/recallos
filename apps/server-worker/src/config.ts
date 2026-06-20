import type { Schema } from "convict";
import type { ReadonlyDeep } from "type-fest";

import { createConfig } from "@repo/server-platform";
import z from "zod";

import localProfile from "../config/local.json";
import productionProfile from "../config/production.json";
import stagingProfile from "../config/staging.json";

const appEnvironmentSchema = z.enum(["local", "staging", "production"]);
const requiredStringSchema = z.string().trim().min(1);
const portSchema = z.number().int().min(1).max(65_535);

const serverWorkerConfigSchema = z.object({
  app: z.object({
    environment: appEnvironmentSchema,
    version: requiredStringSchema,
    http: z.object({
      port: portSchema,
    }),
  }),
  ingestion: z.object({
    mongodb: z.object({
      url: requiredStringSchema,
      databaseName: requiredStringSchema,
    }),
  }),
  knowledge: z.object({
    mongodb: z.object({
      url: requiredStringSchema,
      databaseName: requiredStringSchema,
    }),
    voyageai: z.object({
      apiKey: requiredStringSchema,
    }),
  }),
});

type ServerWorkerConfig = z.infer<typeof serverWorkerConfigSchema>;

const convictConfigSchema: Schema<ServerWorkerConfig> = {
  app: {
    environment: {
      doc: "Application deployment environment",
      format: appEnvironmentSchema.options,
      default: "local",
      env: "APP_ENV",
    },
    version: {
      doc: "Application version",
      format: (value) =>
        serverWorkerConfigSchema.shape.app.shape.version.parse(value),
      default: "0.0.0",
      env: "APP_VERSION",
    },
    http: {
      port: {
        doc: "HTTP port",
        format: (value) =>
          serverWorkerConfigSchema.shape.app.shape.http.shape.port.parse(value),
        default: 8000,
        env: "HTTP_PORT",
      },
    },
  },
  ingestion: {
    mongodb: {
      url: {
        doc: "Ingestion MongoDB connection URL",
        format: (value) =>
          serverWorkerConfigSchema.shape.ingestion.shape.mongodb.shape.url.parse(
            value,
          ),
        default: null,
        env: "INGESTION_MONGODB_URL",
      },
      databaseName: {
        doc: "Ingestion MongoDB database name",
        format: (value) =>
          serverWorkerConfigSchema.shape.ingestion.shape.mongodb.shape.databaseName.parse(
            value,
          ),
        default: null,
        env: "INGESTION_MONGODB_DATABASE_NAME",
      },
    },
  },
  knowledge: {
    mongodb: {
      url: {
        doc: "Knowledge MongoDB connection URL",
        format: (value) =>
          serverWorkerConfigSchema.shape.knowledge.shape.mongodb.shape.url.parse(
            value,
          ),
        default: null,
        env: "KNOWLEDGE_MONGODB_URL",
      },
      databaseName: {
        doc: "Knowledge MongoDB database name",
        format: (value) =>
          serverWorkerConfigSchema.shape.knowledge.shape.mongodb.shape.databaseName.parse(
            value,
          ),
        default: null,
        env: "KNOWLEDGE_MONGODB_DATABASE_NAME",
      },
    },
    voyageai: {
      apiKey: {
        doc: "Voyage AI API key",
        format: (value) =>
          serverWorkerConfigSchema.shape.knowledge.shape.voyageai.shape.apiKey.parse(
            value,
          ),
        default: null,
        env: "KNOWLEDGE_VOYAGEAI_API_KEY",
        sensitive: true,
      },
    },
  },
};

const profiles = {
  local: localProfile,
  staging: stagingProfile,
  production: productionProfile,
} as const;

const config = createConfig({
  schema: convictConfigSchema,
  parser: serverWorkerConfigSchema,
  profiles,
});

export { config, convictConfigSchema, profiles, serverWorkerConfigSchema };
export type { ServerWorkerConfig };
