import { test, expect } from "bun:test";

process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/recallos";
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
