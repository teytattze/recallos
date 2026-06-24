import type {
  IamPrincipal,
  VerifyIamApiKeyPort,
  VerifyIamApiKeyPortInput,
  VerifyIamApiKeyPortOutput,
} from "@repo/server-iam-core";

import {
  createInvalidIamApiKeyError,
  iamPermissions,
} from "@repo/server-iam-core";
import { expect, test } from "bun:test";
import { Hono } from "hono";

import { createIamApiKeyMiddleware } from "./iam-api-key-middleware.ts";
import { getIamTenant, type IamHonoEnv } from "./iam-context.ts";

const principal: IamPrincipal = {
  tenant: "organization:org1",
  organizationId: "org1",
  apiKeyId: "key1",
  permissions: [iamPermissions.knowledgeRead],
};

class FakeVerifyIamApiKey implements VerifyIamApiKeyPort {
  readonly executeCalls: VerifyIamApiKeyPortInput[] = [];

  constructor(private readonly output: VerifyIamApiKeyPortOutput) {}

  execute(input: VerifyIamApiKeyPortInput): VerifyIamApiKeyPortOutput {
    this.executeCalls.push(input);
    return this.output;
  }
}

test("createIamApiKeyMiddleware: given a valid API key, it should inject the IAM principal", async () => {
  const verifyIamApiKey = new FakeVerifyIamApiKey(Promise.resolve(principal));
  const app = new Hono<IamHonoEnv>();

  app.use(
    "*",
    createIamApiKeyMiddleware({
      requiredPermissions: [iamPermissions.knowledgeRead],
      verifyIamApiKey,
    }),
  );
  app.get("/", (c) => c.json({ tenant: getIamTenant(c) }));

  const response = await app.request("http://localhost/", {
    headers: { "X-API-Key": "rcl_valid" },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ tenant: "organization:org1" });
  expect(verifyIamApiKey.executeCalls).toEqual([
    {
      apiKey: "rcl_valid",
      requiredPermissions: [iamPermissions.knowledgeRead],
    },
  ]);
});

test("createIamApiKeyMiddleware: given an invalid API key, it should return 401", async () => {
  const app = new Hono();

  app.use(
    "*",
    createIamApiKeyMiddleware({
      requiredPermissions: [iamPermissions.knowledgeRead],
      verifyIamApiKey: new FakeVerifyIamApiKey(
        Promise.reject(createInvalidIamApiKeyError("Invalid IAM API key")),
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

test("createIamApiKeyMiddleware: given insufficient permissions, it should return 403", async () => {
  const app = new Hono();

  app.use(
    "*",
    createIamApiKeyMiddleware({
      requiredPermissions: [iamPermissions.ingestionWrite],
      verifyIamApiKey: new FakeVerifyIamApiKey(
        Promise.reject({
          kind: "InsufficientIamPermission",
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
