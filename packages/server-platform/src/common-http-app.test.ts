import { expect, test } from "bun:test";

import { createCommonHttpApp } from "./common-http-app.ts";

test("createCommonHttpApp.fetch: given a health request, it should return ok JSON", async () => {
  // GIVEN
  const app = createCommonHttpApp();

  // WHEN
  const response = await app.request("/api/v1/health");

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ message: "ok" });
});
