import { createConfig } from "@repo/server-platform";
import { describe, expect, test } from "bun:test";
import convict from "convict";

import localProfile from "../config/local.json";

type ConfigModule = typeof import("./config.ts");

const localEnv = {
  KNOWLEDGE_VOYAGEAI_API_KEY: "voyage-test-key",
};

const previousApiKey = process.env.KNOWLEDGE_VOYAGEAI_API_KEY;
process.env.KNOWLEDGE_VOYAGEAI_API_KEY = localEnv.KNOWLEDGE_VOYAGEAI_API_KEY;
const configModulePath = "./config.ts?test-definitions";
const { convictConfigSchema, profiles, serverWorkerConfigSchema } =
  (await import(configModulePath)) as ConfigModule;

if (previousApiKey === undefined) {
  delete process.env.KNOWLEDGE_VOYAGEAI_API_KEY;
} else {
  process.env.KNOWLEDGE_VOYAGEAI_API_KEY = previousApiKey;
}

const createServerWorkerConfig = (env: NodeJS.ProcessEnv) =>
  createConfig({
    schema: convictConfigSchema,
    parser: serverWorkerConfigSchema,
    profiles,
    env,
  });

describe("server worker config", () => {
  test("uses local MongoDB defaults and requires the Voyage AI key", () => {
    const config = createServerWorkerConfig(localEnv);

    expect(config).toEqual({
      app: {
        environment: "local",
        version: "0.0.0",
        http: { port: 8001 },
      },
      ingestion: {
        mongodb: {
          url: "mongodb://localhost:27017/?replicaSet=rs0",
          databaseName: "recallos",
        },
      },
      knowledge: {
        mongodb: {
          url: "mongodb://localhost:27017/?replicaSet=rs0",
          databaseName: "recallos",
        },
        voyageai: {
          apiKey: "voyage-test-key",
          embeddingsUrl: "https://api.voyageai.com/v1/embeddings",
        },
      },
    });

    expect(() => createServerWorkerConfig({})).toThrow(
      "knowledge.voyageai.apiKey",
    );
  });

  test("environment variables override and coerce profile values", () => {
    const config = createServerWorkerConfig({
      ...localEnv,
      APP_VERSION: "2.0.0",
      HTTP_PORT: "4141",
      INGESTION_MONGODB_URL: "mongodb://ingestion:27017",
      INGESTION_MONGODB_DATABASE_NAME: "ingestion",
      KNOWLEDGE_MONGODB_URL: "mongodb://knowledge:27017",
      KNOWLEDGE_MONGODB_DATABASE_NAME: "knowledge",
      KNOWLEDGE_VOYAGEAI_EMBEDDINGS_URL:
        "http://voyage-fixture:8080/v1/embeddings",
    });

    expect(config.app).toEqual({
      environment: "local",
      version: "2.0.0",
      http: { port: 4141 },
    });
    expect(config.ingestion.mongodb.databaseName).toBe("ingestion");
    expect(config.knowledge.mongodb.databaseName).toBe("knowledge");
    expect(config.knowledge.voyageai.embeddingsUrl).toBe(
      "http://voyage-fixture:8080/v1/embeddings",
    );
  });

  test.each(["staging", "production"])(
    "%s requires deployment-specific context config",
    (environment) => {
      expect(() =>
        createServerWorkerConfig({ APP_ENV: environment, ...localEnv }),
      ).toThrow();
    },
  );

  test.each([
    [{ APP_ENV: "development", ...localEnv }, "Unsupported APP_ENV"],
    [{ HTTP_PORT: "0", ...localEnv }, "app.http.port"],
    [{ HTTP_PORT: "65536", ...localEnv }, "app.http.port"],
    [{ ...localEnv, KNOWLEDGE_MONGODB_URL: "" }, "knowledge.mongodb.url"],
    [
      { ...localEnv, KNOWLEDGE_VOYAGEAI_EMBEDDINGS_URL: "not-a-url" },
      "knowledge.voyageai.embeddingsUrl",
    ],
    [
      { ...localEnv, KNOWLEDGE_MONGODB_DATABASE_NAME: "   " },
      "knowledge.mongodb.databaseName",
    ],
  ])("rejects invalid environment input", (env, message) => {
    expect(() => createServerWorkerConfig(env)).toThrow(message);
  });

  test("masks the Voyage AI key when Convict serializes config", () => {
    const config = convict(convictConfigSchema, { env: localEnv });
    config.load(localProfile).validate({ allowed: "strict" });

    expect(config.toString()).not.toContain("voyage-test-key");
    expect(config.toString()).toContain("[Sensitive]");
  });
});
