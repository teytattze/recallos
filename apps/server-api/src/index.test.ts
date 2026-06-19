import { expect, test } from "bun:test";

type ServiceModule = typeof import("./index.ts");

const withServerApiEnv = async <T>(run: () => Promise<T>): Promise<T> => {
  const previous = {
    APP_ENV: process.env.APP_ENV,
    HTTP_PORT: process.env.HTTP_PORT,
    INGESTION_MONGODB_URL: process.env.INGESTION_MONGODB_URL,
    INGESTION_MONGODB_DATABASE_NAME:
      process.env.INGESTION_MONGODB_DATABASE_NAME,
  };
  try {
    process.env.APP_ENV = "local";
    process.env.HTTP_PORT = "3131";
    process.env.INGESTION_MONGODB_URL = "mongodb://127.0.0.1:27017";
    process.env.INGESTION_MONGODB_DATABASE_NAME = "recallos-test";

    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("server api: given configured env, it should export the configured port", async () => {
  // GIVEN / WHEN
  const service = await withServerApiEnv(
    () => import(`./index.ts?port=${Date.now()}`) as Promise<ServiceModule>,
  );

  // THEN
  expect(service.default.port).toBe(3131);
});

test("server api fetch: given a health request, it should route through the common app", async () => {
  // GIVEN
  const service = await withServerApiEnv(
    () => import(`./index.ts?health=${Date.now()}`) as Promise<ServiceModule>,
  );

  // WHEN
  const response = await service.default.fetch(
    new Request("http://localhost/api/v1/health"),
  );

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ message: "ok" });
});
