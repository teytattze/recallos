import { defineConfig, envSchema } from "@repo/app-config";
import z from "zod";
import "dotenv/config";

const activeEnv = envSchema.parse(process.env.NODE_ENV);

const config = defineConfig({
  schema: z.object({
    app: z.object({
      version: z.string().min(1),
      http: z.object({
        port: z.coerce.number().int().positive(),
      }),
    }),
    ingestion: z.object({
      mongodb: z.object({
        url: z.string().min(1),
        databaseName: z.string().min(1),
      }),
    }),
    iam: z.object({
      baseUrl: z.string().min(1),
      basePath: z.string().min(1),
      trustedOrigins: z.url().array(),
      secrets: z
        .object({
          version: z.coerce.number().int().positive(),
          value: z.string().min(1),
        })
        .array(),
      mongodb: z.object({
        url: z.string().min(1),
        databaseName: z.string().min(1),
      }),
      resend: z.object({
        apiKey: z.string().min(1),
        from: z.string().min(1),
      }),
      otp: z.object({
        length: z.coerce.number().int().min(6).max(10),
        expiresInSeconds: z.coerce.number().int().min(60),
        allowedAttempts: z.coerce.number().int().min(1).max(10),
      }),
      apiKey: z.object({
        configId: z.string().min(1),
        prefix: z.string().min(1),
        rateLimit: z.object({
          enabled: z.coerce.boolean(),
          maxRequests: z.coerce.number().int().min(1),
          timeWindowMilliseconds: z.coerce.number().int().min(1_000),
        }),
      }),
    }),
    knowledge: z.object({
      mongodb: z.object({
        url: z.string().min(1),
        databaseName: z.string().min(1),
      }),
      voyageai: z.object({
        apiKey: z.string().min(1),
      }),
    }),
  }),

  base: {
    local: {
      app: {
        version: "0.0.0",
        http: { port: 8000 },
      },
      ingestion: {
        mongodb: {
          databaseName: "recallos",
        },
      },
      iam: {
        baseUrl: "http://localhost:8000",
        basePath: "/api/v1/iam",
        mongodb: {
          databaseName: "recallos",
        },
        resend: {
          apiKey: "local-resend-api-key",
          from: "RecallOS <noreply@notifications.recallos.io>",
        },
        otp: {
          length: 8,
          expiresInSeconds: 300,
          allowedAttempts: 3,
        },
        apiKey: {
          configId: "org-keys",
          prefix: "rcl_",
          rateLimit: {
            enabled: true,
            maxRequests: 1000,
            timeWindowMilliseconds: 3_600_000,
          },
        },
      },
      knowledge: {
        mongodb: {
          databaseName: "recallos",
        },
      },
    },

    test: {
      app: {
        version: "0.0.0",
        http: { port: 8000 },
      },
      ingestion: {
        mongodb: {
          databaseName: "recallos",
        },
      },
      iam: {
        baseUrl: "http://localhost:8000",
        basePath: "/api/v1/iam",
        mongodb: {
          databaseName: "recallos",
        },
        resend: {
          apiKey: "local-resend-api-key",
          from: "RecallOS <noreply@notifications.recallos.io>",
        },
        otp: {
          length: 8,
          expiresInSeconds: 300,
          allowedAttempts: 3,
        },
        apiKey: {
          configId: "org-keys",
          prefix: "rcl_",
          rateLimit: {
            enabled: true,
            maxRequests: 1000,
            timeWindowMilliseconds: 3_600_000,
          },
        },
      },
      knowledge: {
        mongodb: {
          databaseName: "recallos",
        },
      },
    },

    staging: {},

    production: {},
  },

  runtime: {
    app: {
      version: process.env.APP_VERSION,
      http: {
        port: process.env.APP_HTTP_PORT,
      },
    },
    ingestion: {
      mongodb: {
        url: process.env.INGESTION_MONGODB_URL,
        databaseName: process.env.INGESTION_MONGODB_DATABASE_NAME,
      },
    },
    iam: {
      baseUrl: process.env.IAM_BASE_URL,
      basePath: process.env.IAM_BASE_PATH,
      trustedOrigins: JSON.parse(process.env.IAM_TRUSTED_ORIGINS ?? "[]"),
      secrets: JSON.parse(process.env.IAM_SECRETS ?? "[]"),
      mongodb: {
        url: process.env.IAM_MONGODB_URL,
        databaseName: process.env.IAM_MONGODB_DATABASE_NAME,
      },
      resend: {
        apiKey: process.env.IAM_RESEND_API_KEY,
        from: process.env.IAM_RESEND_FROM,
      },
      otp: {
        length: process.env.IAM_OTP_LENGTH,
        expiresInSeconds: process.env.IAM_OTP_EXPIRES_IN_SECONDS,
        allowedAttempts: process.env.IAM_OTP_ALLOWED_ATTEMPTS,
      },
      apiKey: {
        configId: process.env.IAM_API_KEY_CONFIG_ID,
        prefix: process.env.IAM_API_KEY_PREFIX,
        rateLimit: {
          enabled: process.env.IAM_API_KEY_RATE_LIMIT_ENABLED,
          maxRequests: process.env.IAM_API_KEY_RATE_LIMIT_MAX_REQUESTS,
          timeWindowMilliseconds:
            process.env.IAM_API_KEY_RATE_LIMIT_TIME_WINDOW_MILLISECONDS,
        },
      },
    },
    knowledge: {
      mongodb: {
        url: process.env.KNOWLEDGE_MONGODB_URL,
        databaseName: process.env.KNOWLEDGE_MONGODB_DATABASE_NAME,
      },
      voyageai: {
        apiKey: process.env.KNOWLEDGE_VOYAGEAI_API_KEY,
      },
    },
  },
})(activeEnv);

export { config };
