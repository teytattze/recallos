import { describe, expect, test } from "bun:test";
import convict from "convict";

import localProfile from "../config/local.json";
import { convictConfigSchema, createConfig } from "./config.ts";

const localEnv = {
  KNOWLEDGE_VOYAGEAI_API_KEY: "voyage-test-key",
};

describe("server worker config", () => {
  test("uses local MongoDB defaults and requires the Voyage AI key", () => {
    const config = createConfig({ env: localEnv });

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
      knowledge: {
        mongodb: {
          url: "mongodb://localhost:27017/?replicaSet=rs0",
          databaseName: "recallos",
        },
        voyageai: { apiKey: "voyage-test-key" },
      },
    });

    expect(() => createConfig({ env: {} })).toThrow(
      "knowledge.voyageai.apiKey",
    );
  });

  test("environment variables override and coerce profile values", () => {
    const config = createConfig({
      env: {
        ...localEnv,
        APP_VERSION: "2.0.0",
        HTTP_PORT: "4141",
        INGESTION_MONGODB_URL: "mongodb://ingestion:27017",
        INGESTION_MONGODB_DATABASE_NAME: "ingestion",
        KNOWLEDGE_MONGODB_URL: "mongodb://knowledge:27017",
        KNOWLEDGE_MONGODB_DATABASE_NAME: "knowledge",
      },
    });

    expect(config.app).toEqual({
      environment: "local",
      version: "2.0.0",
      http: { port: 4141 },
    });
    expect(config.ingestion.mongodb.databaseName).toBe("ingestion");
    expect(config.knowledge.mongodb.databaseName).toBe("knowledge");
  });

  test.each(["staging", "production"])(
    "%s requires deployment-specific context config",
    (environment) => {
      expect(() =>
        createConfig({
          env: { APP_ENV: environment, ...localEnv },
        }),
      ).toThrow();
    },
  );

  test.each([
    [{ APP_ENV: "development", ...localEnv }, "Unsupported APP_ENV"],
    [{ HTTP_PORT: "0", ...localEnv }, "app.http.port"],
    [{ HTTP_PORT: "65536", ...localEnv }, "app.http.port"],
    [{ ...localEnv, KNOWLEDGE_MONGODB_URL: "" }, "knowledge.mongodb.url"],
    [
      { ...localEnv, KNOWLEDGE_MONGODB_DATABASE_NAME: "   " },
      "knowledge.mongodb.databaseName",
    ],
  ])("rejects invalid environment input", (env, message) => {
    expect(() => createConfig({ env })).toThrow(message);
  });

  test("masks the Voyage AI key when Convict serializes config", () => {
    const config = convict(convictConfigSchema, { env: localEnv });
    config.load(localProfile).validate({ allowed: "strict" });

    expect(config.toString()).not.toContain("voyage-test-key");
    expect(config.toString()).toContain("[Sensitive]");
  });
});
