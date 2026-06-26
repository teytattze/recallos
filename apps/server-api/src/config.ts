import type { Schema } from "convict";

import { createConfig } from "@repo/server-platform";
import z from "zod";

import localProfile from "../config/local.json";
import productionProfile from "../config/production.json";
import stagingProfile from "../config/staging.json";

const appEnvironmentSchema = z.enum(["local", "staging", "production"]);
const requiredStringSchema = z.string().trim().min(1);
const booleanSchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());
const portSchema = z.number().int().min(1).max(65_535);
const trustedOriginsSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}, z.array(requiredStringSchema).min(1));
const iamSecretsSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    if (trimmed.startsWith("[")) return JSON.parse(trimmed) as unknown;

    return trimmed.split(",").map((secret) => {
      const [version, ...secretParts] = secret.split(":");

      return {
        version: Number(version),
        value: secretParts.join(":"),
      };
    });
  },
  z
    .array(z.object({ version: z.number().int(), value: requiredStringSchema }))
    .min(1),
);

const serverApiConfigSchema = z.object({
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
  iam: z.object({
    baseUrl: requiredStringSchema,
    basePath: requiredStringSchema,
    trustedOrigins: trustedOriginsSchema,
    secrets: iamSecretsSchema,
    mongodb: z.object({
      url: requiredStringSchema,
      databaseName: requiredStringSchema,
    }),
    resend: z.object({
      apiKey: requiredStringSchema,
      from: requiredStringSchema,
    }),
    otp: z.object({
      length: z.number().int().min(6).max(10),
      expiresInSeconds: z.number().int().min(60),
      allowedAttempts: z.number().int().min(1).max(10),
    }),
    apiKey: z.object({
      configId: requiredStringSchema,
      prefix: requiredStringSchema,
      rateLimit: z.object({
        enabled: booleanSchema,
        maxRequests: z.number().int().min(1),
        timeWindowMilliseconds: z.number().int().min(1_000),
      }),
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

type ServerApiConfig = z.infer<typeof serverApiConfigSchema>;

const convictConfigSchema: Schema<ServerApiConfig> = {
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
        serverApiConfigSchema.shape.app.shape.version.parse(value),
      default: "0.0.0",
      env: "APP_VERSION",
    },
    http: {
      port: {
        doc: "HTTP port",
        format: (value) =>
          serverApiConfigSchema.shape.app.shape.http.shape.port.parse(value),
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
          serverApiConfigSchema.shape.ingestion.shape.mongodb.shape.url.parse(
            value,
          ),
        default: null,
        env: "INGESTION_MONGODB_URL",
      },
      databaseName: {
        doc: "Ingestion MongoDB database name",
        format: (value) =>
          serverApiConfigSchema.shape.ingestion.shape.mongodb.shape.databaseName.parse(
            value,
          ),
        default: null,
        env: "INGESTION_MONGODB_DATABASE_NAME",
      },
    },
  },
  iam: {
    baseUrl: {
      doc: "IAM public base URL",
      format: (value) =>
        serverApiConfigSchema.shape.iam.shape.baseUrl.parse(value),
      default: null,
      env: "IAM_BASE_URL",
    },
    basePath: {
      doc: "IAM Better Auth base path",
      format: (value) =>
        serverApiConfigSchema.shape.iam.shape.basePath.parse(value),
      default: "/api/v1/iam",
      env: "IAM_BASE_PATH",
    },
    trustedOrigins: {
      doc: "Comma-separated IAM trusted origins",
      format: (value) =>
        serverApiConfigSchema.shape.iam.shape.trustedOrigins.parse(value),
      default: null,
      env: "IAM_TRUSTED_ORIGINS",
    },
    secrets: {
      doc: "Comma-separated versioned IAM secrets, e.g. 1:secret",
      format: (value) =>
        serverApiConfigSchema.shape.iam.shape.secrets.parse(value),
      default: null,
      env: "IAM_SECRETS",
      sensitive: true,
    },
    mongodb: {
      url: {
        doc: "IAM MongoDB connection URL",
        format: (value) =>
          serverApiConfigSchema.shape.iam.shape.mongodb.shape.url.parse(value),
        default: null,
        env: "IAM_MONGODB_URL",
      },
      databaseName: {
        doc: "IAM MongoDB database name",
        format: (value) =>
          serverApiConfigSchema.shape.iam.shape.mongodb.shape.databaseName.parse(
            value,
          ),
        default: null,
        env: "IAM_MONGODB_DATABASE_NAME",
      },
    },
    resend: {
      apiKey: {
        doc: "Resend API key for IAM OTP emails",
        format: (value) =>
          serverApiConfigSchema.shape.iam.shape.resend.shape.apiKey.parse(
            value,
          ),
        default: null,
        env: "IAM_RESEND_API_KEY",
        sensitive: true,
      },
      from: {
        doc: "Resend sender address for IAM OTP emails",
        format: (value) =>
          serverApiConfigSchema.shape.iam.shape.resend.shape.from.parse(value),
        default: null,
        env: "IAM_RESEND_FROM",
      },
    },
    otp: {
      length: {
        doc: "IAM email OTP length",
        format: (value) =>
          serverApiConfigSchema.shape.iam.shape.otp.shape.length.parse(value),
        default: 6,
        env: "IAM_OTP_LENGTH",
      },
      expiresInSeconds: {
        doc: "IAM email OTP expiration in seconds",
        format: (value) =>
          serverApiConfigSchema.shape.iam.shape.otp.shape.expiresInSeconds.parse(
            value,
          ),
        default: 300,
        env: "IAM_OTP_EXPIRES_IN_SECONDS",
      },
      allowedAttempts: {
        doc: "IAM email OTP allowed attempts",
        format: (value) =>
          serverApiConfigSchema.shape.iam.shape.otp.shape.allowedAttempts.parse(
            value,
          ),
        default: 3,
        env: "IAM_OTP_ALLOWED_ATTEMPTS",
      },
    },
    apiKey: {
      configId: {
        doc: "IAM Better Auth API key config id",
        format: (value) =>
          serverApiConfigSchema.shape.iam.shape.apiKey.shape.configId.parse(
            value,
          ),
        default: "org-keys",
        env: "IAM_API_KEY_CONFIG_ID",
      },
      prefix: {
        doc: "IAM API key prefix",
        format: (value) =>
          serverApiConfigSchema.shape.iam.shape.apiKey.shape.prefix.parse(
            value,
          ),
        default: "rcl_",
        env: "IAM_API_KEY_PREFIX",
      },
      rateLimit: {
        enabled: {
          doc: "Enable per-IAM API key rate limits",
          format: (value) =>
            serverApiConfigSchema.shape.iam.shape.apiKey.shape.rateLimit.shape.enabled.parse(
              value,
            ),
          default: true,
          env: "IAM_API_KEY_RATE_LIMIT_ENABLED",
        },
        maxRequests: {
          doc: "Per-IAM API key rate limit request count",
          format: (value) =>
            serverApiConfigSchema.shape.iam.shape.apiKey.shape.rateLimit.shape.maxRequests.parse(
              value,
            ),
          default: 1_000,
          env: "IAM_API_KEY_RATE_LIMIT_MAX_REQUESTS",
        },
        timeWindowMilliseconds: {
          doc: "Per-IAM API key rate limit window in milliseconds",
          format: (value) =>
            serverApiConfigSchema.shape.iam.shape.apiKey.shape.rateLimit.shape.timeWindowMilliseconds.parse(
              value,
            ),
          default: 3_600_000,
          env: "IAM_API_KEY_RATE_LIMIT_TIME_WINDOW_MILLISECONDS",
        },
      },
    },
  },
  knowledge: {
    mongodb: {
      url: {
        doc: "Knowledge MongoDB connection URL",
        format: (value) =>
          serverApiConfigSchema.shape.knowledge.shape.mongodb.shape.url.parse(
            value,
          ),
        default: null,
        env: "KNOWLEDGE_MONGODB_URL",
      },
      databaseName: {
        doc: "Knowledge MongoDB database name",
        format: (value) =>
          serverApiConfigSchema.shape.knowledge.shape.mongodb.shape.databaseName.parse(
            value,
          ),
        default: null,
        env: "KNOWLEDGE_MONGODB_DATABASE_NAME",
      },
    },
    voyageai: {
      apiKey: {
        doc: "Voyage AI API key for knowledge embeddings",
        format: (value) =>
          serverApiConfigSchema.shape.knowledge.shape.voyageai.shape.apiKey.parse(
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
  parser: serverApiConfigSchema,
  profiles,
});

export { config, convictConfigSchema, profiles, serverApiConfigSchema };
export type { ServerApiConfig };
