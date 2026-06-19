import { describe, expect, test } from "bun:test";

import { createConfig } from "./config.ts";

describe("server API config", () => {
  test("uses the local profile by default", () => {
    const config = createConfig({ env: {} });

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
    });
  });

  test("environment variables override the selected profile", () => {
    const config = createConfig({
      env: {
        APP_ENV: "local",
        APP_VERSION: "1.2.3",
        HTTP_PORT: "3131",
        INGESTION_MONGODB_URL: "mongodb://database:27017",
        INGESTION_MONGODB_DATABASE_NAME: "recallos-test",
      },
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
  });

  test.each(["staging", "production"])(
    "%s requires deployment-specific ingestion config",
    (environment) => {
      expect(() => createConfig({ env: { APP_ENV: environment } })).toThrow();
    },
  );

  test.each([
    [{ APP_ENV: "development" }, "Unsupported APP_ENV"],
    [{ HTTP_PORT: "invalid" }, "app.http.port"],
    [{ INGESTION_MONGODB_URL: "" }, "ingestion.mongodb.url"],
  ])("rejects invalid environment input", (env, message) => {
    expect(() => createConfig({ env })).toThrow(message);
  });
});
