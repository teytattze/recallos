import { expect, test } from "bun:test";

import { AppError } from "@repo/app-error";
import { Hono } from "hono";
import { z } from "zod";

import { createHttpErrorHandler } from "./http-error-handler.ts";

const createApp = (handler: () => Response | Promise<Response>) => {
  const app = new Hono();
  app.onError(createHttpErrorHandler());
  app.get("/test", handler);
  return app;
};

test("createHttpErrorHandler: given a handler that succeeds, it should pass the response through", async () => {
  // GIVEN
  const app = createApp(() => Response.json({ message: "ok" }));

  // WHEN
  const response = await app.request("/test");

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ message: "ok" });
});

test("createHttpErrorHandler: given a handler that throws an AppError, it should return the mapped status and error JSON", async () => {
  // GIVEN
  const app = createApp(() => {
    throw AppError.ofCode("serverKnowledgeCore.graphNotFound");
  });

  // WHEN
  const response = await app.request("/test");

  // THEN
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    code: "serverKnowledgeCore.graphNotFound",
    message: "Not found",
  });
});

test("createHttpErrorHandler: given a handler that throws an unknown error, it should return 500 with the unknown error JSON", async () => {
  // GIVEN
  const app = createApp(() => {
    throw new Error("boom");
  });

  // WHEN
  const response = await app.request("/test");

  // THEN
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    code: "unknown",
    message: "Unknown error",
  });
});

test("createHttpErrorHandler: given a handler that throws a ZodError, it should return 422 with the invariant violation JSON", async () => {
  // GIVEN
  const app = createApp(() => {
    z.string().parse(1);
    return Response.json({ message: "unreachable" });
  });

  // WHEN
  const response = await app.request("/test");

  // THEN
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    code: "invariantViolation",
    message: "Invariant violation",
  });
});

test("createHttpErrorHandler: given a sub-app route that throws, it should map the error from the parent app", async () => {
  // GIVEN
  const subApp = new Hono();
  subApp.get("/test", () => {
    throw AppError.ofCode("serverIamCore.missingApiKey");
  });
  const app = new Hono();
  app.onError(createHttpErrorHandler());
  app.route("", subApp);

  // WHEN
  const response = await app.request("/test");

  // THEN
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({
    code: "serverIamCore.missingApiKey",
    message: "Unauthorized",
  });
});
