import { createConfig } from "@repo/server-platform";
import { describe, expect, test } from "bun:test";

type ConfigModule = typeof import("./config.ts");

const configModulePath = "./config.ts?test-definitions";
const { convictConfigSchema, profiles, serverApiConfigSchema } = (await import(
  configModulePath
)) as ConfigModule;

const createServerApiConfig = (env: NodeJS.ProcessEnv) =>
  createConfig({
    schema: convictConfigSchema,
    parser: serverApiConfigSchema,
    profiles,
    env,
  });

describe("server API config", () => {
  test("uses the local profile by default", () => {
    const config = createServerApiConfig({});

    expect(config).toEqual({
      app: {
        environment: "local",
        version: "0.0.0",
        http: { port: 8000 },
      },
      ingestion: {
        mongodb: {
          url: "mongodb://localhost:27017/?replicaSet=rs0",
          databaseName: "recallos",
        },
      },
      iam: {
        baseUrl: "http://localhost:8000",
        basePath: "/api/v1/iam",
        trustedOrigins: ["http://localhost:3000", "http://localhost:8000"],
        secrets: [
          {
            version: 1,
            value: "local-iam-secret-change-before-production",
          },
        ],
        mongodb: {
          url: "mongodb://localhost:27017/?replicaSet=rs0",
          databaseName: "recallos-iam",
        },
        resend: {
          apiKey: "local-resend-api-key",
          from: "RecallOS <noreply@example.local>",
        },
        otp: {
          length: 6,
          expiresInSeconds: 300,
          allowedAttempts: 3,
        },
        apiKey: {
          configId: "org-keys",
          prefix: "rcl_",
          rateLimit: {
            enabled: true,
            maxRequests: 1000,
            timeWindowMilliseconds: 3600000,
          },
        },
      },
      knowledge: {
        mongodb: {
          url: "mongodb://localhost:27017/?replicaSet=rs0",
          databaseName: "recallos",
        },
        voyageai: { apiKey: "local-voyageai-api-key" },
      },
    });
  });

  test("environment variables override the selected profile", () => {
    const config = createServerApiConfig({
      APP_ENV: "local",
      APP_VERSION: "1.2.3",
      HTTP_PORT: "3131",
      INGESTION_MONGODB_URL: "mongodb://database:27017",
      INGESTION_MONGODB_DATABASE_NAME: "recallos-test",
      IAM_BASE_URL: "https://api.example.com",
      IAM_BASE_PATH: "/api/v1/iam",
      IAM_TRUSTED_ORIGINS: "https://app.example.com,https://api.example.com",
      IAM_SECRETS: "2:new-secret,1:old-secret",
      IAM_MONGODB_URL: "mongodb://iam-database:27017",
      IAM_MONGODB_DATABASE_NAME: "iam-test",
      IAM_RESEND_API_KEY: "re_test",
      IAM_RESEND_FROM: "RecallOS <noreply@example.com>",
      IAM_OTP_LENGTH: "8",
      IAM_OTP_EXPIRES_IN_SECONDS: "600",
      IAM_OTP_ALLOWED_ATTEMPTS: "5",
      IAM_API_KEY_CONFIG_ID: "org-api-keys",
      IAM_API_KEY_PREFIX: "rcl_",
      IAM_API_KEY_RATE_LIMIT_ENABLED: "false",
      IAM_API_KEY_RATE_LIMIT_MAX_REQUESTS: "25",
      IAM_API_KEY_RATE_LIMIT_TIME_WINDOW_MILLISECONDS: "60000",
      KNOWLEDGE_MONGODB_URL: "mongodb://knowledge-database:27017",
      KNOWLEDGE_MONGODB_DATABASE_NAME: "knowledge-test",
      KNOWLEDGE_VOYAGEAI_API_KEY: "pa_test",
    });

    expect(config.app).toEqual({
      environment: "local",
      version: "1.2.3",
      http: { port: 3131 },
    });
    expect(config.ingestion.mongodb).toEqual({
      url: "mongodb://database:27017",
      databaseName: "recallos-test",
    });
    expect(config.iam).toEqual({
      baseUrl: "https://api.example.com",
      basePath: "/api/v1/iam",
      trustedOrigins: ["https://app.example.com", "https://api.example.com"],
      secrets: [
        { version: 2, value: "new-secret" },
        { version: 1, value: "old-secret" },
      ],
      mongodb: {
        url: "mongodb://iam-database:27017",
        databaseName: "iam-test",
      },
      resend: {
        apiKey: "re_test",
        from: "RecallOS <noreply@example.com>",
      },
      otp: {
        length: 8,
        expiresInSeconds: 600,
        allowedAttempts: 5,
      },
      apiKey: {
        configId: "org-api-keys",
        prefix: "rcl_",
        rateLimit: {
          enabled: false,
          maxRequests: 25,
          timeWindowMilliseconds: 60000,
        },
      },
    });
    expect(config.knowledge).toEqual({
      mongodb: {
        url: "mongodb://knowledge-database:27017",
        databaseName: "knowledge-test",
      },
      voyageai: { apiKey: "pa_test" },
    });
  });

  test.each(["staging", "production"])(
    "%s requires deployment-specific datastore config",
    (environment) => {
      expect(() => createServerApiConfig({ APP_ENV: environment })).toThrow();
    },
  );

  test.each([
    [{ APP_ENV: "development" }, "Unsupported APP_ENV"],
    [{ HTTP_PORT: "invalid" }, "app.http.port"],
    [{ HTTP_PORT: "65536" }, "app.http.port"],
    [{ INGESTION_MONGODB_URL: "" }, "ingestion.mongodb.url"],
    [
      { INGESTION_MONGODB_DATABASE_NAME: "   " },
      "ingestion.mongodb.databaseName",
    ],
    [{ IAM_BASE_URL: "" }, "iam.baseUrl"],
    [{ IAM_TRUSTED_ORIGINS: "" }, "iam.trustedOrigins"],
    [{ IAM_SECRETS: "" }, "iam.secrets"],
    [{ IAM_MONGODB_URL: "" }, "iam.mongodb.url"],
    [{ IAM_MONGODB_DATABASE_NAME: "" }, "iam.mongodb.databaseName"],
    [{ IAM_RESEND_API_KEY: "" }, "iam.resend.apiKey"],
    [{ IAM_OTP_LENGTH: "5" }, "iam.otp.length"],
    [{ KNOWLEDGE_MONGODB_URL: "" }, "knowledge.mongodb.url"],
    [
      { KNOWLEDGE_MONGODB_DATABASE_NAME: "   " },
      "knowledge.mongodb.databaseName",
    ],
    [{ KNOWLEDGE_VOYAGEAI_API_KEY: "" }, "knowledge.voyageai.apiKey"],
  ])("rejects invalid environment input", (env, message) => {
    expect(() => createServerApiConfig(env)).toThrow(message);
  });
});
