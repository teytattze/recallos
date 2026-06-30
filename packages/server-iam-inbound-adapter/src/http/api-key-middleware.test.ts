import type {
  Principal,
  VerifyApiKeyPort,
  VerifyApiKeyPortInput,
  VerifyApiKeyPortOutput,
} from "@repo/server-iam-core";

import { createInvalidApiKeyError, permissions } from "@repo/server-iam-core";
import { expect, test } from "bun:test";
import { Hono } from "hono";

import { createApiKeyMiddleware } from "./api-key-middleware.ts";
import { getTenant, type HonoEnv } from "./context.ts";

const principal: Principal = {
  tenant: "organization:org1",
  organizationId: "org1",
  authenticationMethod: "api-key",
  apiKeyId: "key1",
  permissions: [permissions.knowledgeRead],
};

class FakeVerifyApiKey implements VerifyApiKeyPort {
  readonly executeCalls: VerifyApiKeyPortInput[] = [];

  constructor(private readonly output: VerifyApiKeyPortOutput) {}

  execute(input: VerifyApiKeyPortInput): VerifyApiKeyPortOutput {
    this.executeCalls.push(input);
    return this.output;
  }
}

test("createApiKeyMiddleware: given a valid API key, it should inject the principal", async () => {
  const verifyApiKey = new FakeVerifyApiKey(Promise.resolve(principal));
  const app = new Hono<HonoEnv>();

  app.use(
    "*",
    createApiKeyMiddleware({
      requiredPermissions: [permissions.knowledgeRead],
      verifyApiKey,
    }),
  );
  app.get("/", (c) => c.json({ tenant: getTenant(c) }));

  const response = await app.request("http://localhost/", {
    headers: { "X-API-Key": "rcl_valid" },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ tenant: "organization:org1" });
  expect(verifyApiKey.executeCalls).toEqual([
    {
      apiKey: "rcl_valid",
      requiredPermissions: [permissions.knowledgeRead],
    },
  ]);
});

test("createApiKeyMiddleware: given an invalid API key, it should return 401", async () => {
  const app = new Hono();

  app.use(
    "*",
    createApiKeyMiddleware({
      requiredPermissions: [permissions.knowledgeRead],
      verifyApiKey: new FakeVerifyApiKey(
        Promise.reject(createInvalidApiKeyError("Invalid API key")),
      ),
    }),
  );
  app.get("/", (c) => c.json({ ok: true }));

  const response = await app.request("http://localhost/", {
    headers: { "X-API-Key": "rcl_invalid" },
  });

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ message: "Unauthorized" });
});

test("createApiKeyMiddleware: given insufficient permissions, it should return 403", async () => {
  const app = new Hono();

  app.use(
    "*",
    createApiKeyMiddleware({
      requiredPermissions: [permissions.ingestionWrite],
      verifyApiKey: new FakeVerifyApiKey(
        Promise.reject({
          kind: "InsufficientPermission",
          category: "forbidden",
          message: "Forbidden",
        }),
      ),
    }),
  );
  app.get("/", (c) => c.json({ ok: true }));

  const response = await app.request("http://localhost/", {
    headers: { "X-API-Key": "rcl_readonly" },
  });

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ message: "Forbidden" });
});
