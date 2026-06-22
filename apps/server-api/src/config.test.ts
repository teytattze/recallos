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
      knowledge: {
        mongodb: {
          url: "mongodb://localhost:27017/?replicaSet=rs0",
          databaseName: "recallos",
        },
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
      KNOWLEDGE_MONGODB_URL: "mongodb://knowledge-database:27017",
      KNOWLEDGE_MONGODB_DATABASE_NAME: "knowledge-test",
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
    expect(config.knowledge.mongodb).toEqual({
      url: "mongodb://knowledge-database:27017",
      databaseName: "knowledge-test",
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
    [{ KNOWLEDGE_MONGODB_URL: "" }, "knowledge.mongodb.url"],
    [
      { KNOWLEDGE_MONGODB_DATABASE_NAME: "   " },
      "knowledge.mongodb.databaseName",
    ],
  ])("rejects invalid environment input", (env, message) => {
    expect(() => createServerApiConfig(env)).toThrow(message);
  });
});
