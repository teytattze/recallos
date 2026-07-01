import { expect, test } from "bun:test";

type ServiceModule = typeof import("./index.ts");

const withServerApiEnv = async <T>(run: () => Promise<T>): Promise<T> => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    APP_HTTP_PORT: process.env.APP_HTTP_PORT,
    INGESTION_MONGODB_URL: process.env.INGESTION_MONGODB_URL,
    INGESTION_MONGODB_DATABASE_NAME:
      process.env.INGESTION_MONGODB_DATABASE_NAME,
    IAM_MONGODB_URL: process.env.IAM_MONGODB_URL,
    IAM_TRUSTED_ORIGINS: process.env.IAM_TRUSTED_ORIGINS,
    IAM_SECRETS: process.env.IAM_SECRETS,
    KNOWLEDGE_MONGODB_URL: process.env.KNOWLEDGE_MONGODB_URL,
    KNOWLEDGE_MONGODB_DATABASE_NAME:
      process.env.KNOWLEDGE_MONGODB_DATABASE_NAME,
    KNOWLEDGE_VOYAGEAI_API_KEY: process.env.KNOWLEDGE_VOYAGEAI_API_KEY,
  };
  try {
    process.env.NODE_ENV = "local";
    process.env.APP_HTTP_PORT = "3131";
    process.env.INGESTION_MONGODB_URL = "mongodb://127.0.0.1:27017";
    process.env.INGESTION_MONGODB_DATABASE_NAME = "recallos-test";
    process.env.IAM_MONGODB_URL = "mongodb://127.0.0.1:27017";
    process.env.IAM_TRUSTED_ORIGINS = JSON.stringify(["http://localhost:8000"]);
    process.env.IAM_SECRETS = JSON.stringify([
      { version: 1, value: "local-iam-secret-change-before-production" },
    ]);
    process.env.KNOWLEDGE_MONGODB_URL = "mongodb://127.0.0.1:27017";
    process.env.KNOWLEDGE_MONGODB_DATABASE_NAME = "recallos-test";
    process.env.KNOWLEDGE_VOYAGEAI_API_KEY = "pa_test";

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

test("server api fetch: given a graph node request without an IAM API key, it should return 401", async () => {
  // GIVEN
  const service = await withServerApiEnv(
    () =>
      import(`./index.ts?knowledge=${Date.now()}`) as Promise<ServiceModule>,
  );

  // WHEN
  const response = await service.default.fetch(
    new Request(
      "http://localhost/api/v1/graphs/01952d3f-0000-7000-8000-000000000100/nodes?eventId=event-1",
    ),
  );

  // THEN
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ message: "Unauthorized" });
});

test("server api fetch: given a knowledge search request without an IAM API key, it should return 401", async () => {
  // GIVEN
  const service = await withServerApiEnv(
    () =>
      import(
        `./index.ts?knowledgeSearch=${Date.now()}`
      ) as Promise<ServiceModule>,
  );

  // WHEN
  const response = await service.default.fetch(
    new Request(
      "http://localhost/api/v1/graphs/01952d3f-0000-7000-8000-000000000100/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "billing incident" }),
      },
    ),
  );

  // THEN
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ message: "Unauthorized" });
});

test("server api fetch: given an MCP request without an IAM API key, it should return 401", async () => {
  // GIVEN
  const service = await withServerApiEnv(
    () => import(`./index.ts?mcp=${Date.now()}`) as Promise<ServiceModule>,
  );

  // WHEN
  const response = await service.default.fetch(
    new Request("http://localhost/api/v1/knowledge/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }),
  );

  // THEN
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ message: "Unauthorized" });
});
