import { test, expect } from "bun:test";
import { Hono } from "hono";

process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/recallos";
process.env.MONGODB_URL = "mongodb://localhost:27017";
process.env.PORT = "8765";

const service = await import("./index.ts");

test("server-api-service default export: given PORT in env, it should expose the parsed port", () => {
  // THEN
  expect(service.default.port).toBe(8765);
});

test("GET /api/v1/health: given a health request, it should respond ok", async () => {
  // WHEN
  const res = await service.default.fetch(
    new Request("http://localhost/api/v1/health"),
  );

  // THEN
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ message: "ok" });
});

test("createApp: given an ingestion app, it should mount the ingestion routes", async () => {
  // GIVEN
  const ingestionApp = new Hono();
  ingestionApp.get("/api/v1/external-providers/jira/test", (c) =>
    c.json({ message: "ingestion" }),
  );
  const app = service.createApp({ ingestionApp });

  // WHEN
  const res = await app.request(
    "http://localhost/api/v1/external-providers/jira/test",
  );

  // THEN
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ message: "ingestion" });
});
