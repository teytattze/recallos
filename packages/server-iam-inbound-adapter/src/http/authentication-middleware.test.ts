import type {
  Principal,
  VerifyApiKeyPort,
  VerifyApiKeyPortInput,
  VerifyApiKeyPortOutput,
  VerifySessionCookiePort,
  VerifySessionCookiePortInput,
  VerifySessionCookiePortOutput,
} from "@repo/server-iam-core";

import {
  createInvalidSessionCookieError,
  permissions,
} from "@repo/server-iam-core";
import { expect, test } from "bun:test";
import { Hono } from "hono";

import { createAuthenticationMiddleware } from "./authentication-middleware.ts";
import { getTenant, type HonoEnv } from "./context.ts";

const apiKeyPrincipal: Principal = {
  tenant: "organization:org1",
  organizationId: "org1",
  authenticationMethod: "api-key",
  apiKeyId: "key1",
  permissions: [permissions.knowledgeRead],
};

const sessionPrincipal: Principal = {
  tenant: "organization:org2",
  organizationId: "org2",
  authenticationMethod: "session-cookie",
  sessionId: "session1",
  userId: "user1",
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

class FakeVerifySessionCookie implements VerifySessionCookiePort {
  readonly executeCalls: VerifySessionCookiePortInput[] = [];

  constructor(private readonly output: VerifySessionCookiePortOutput) {}

  execute(input: VerifySessionCookiePortInput): VerifySessionCookiePortOutput {
    this.executeCalls.push(input);
    return this.output;
  }
}

test("createAuthenticationMiddleware: given a valid API key, it should inject the API key principal", async () => {
  const verifyApiKey = new FakeVerifyApiKey(Promise.resolve(apiKeyPrincipal));
  const verifySessionCookie = new FakeVerifySessionCookie(
    Promise.resolve(sessionPrincipal),
  );
  const app = new Hono<HonoEnv>();

  app.use(
    "*",
    createAuthenticationMiddleware({
      requiredPermissions: [permissions.knowledgeRead],
      verifyApiKey,
      verifySessionCookie,
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
  expect(verifySessionCookie.executeCalls).toEqual([]);
});

test("createAuthenticationMiddleware: given a valid session cookie without an API key, it should inject the session principal", async () => {
  const verifyApiKey = new FakeVerifyApiKey(Promise.resolve(apiKeyPrincipal));
  const verifySessionCookie = new FakeVerifySessionCookie(
    Promise.resolve(sessionPrincipal),
  );
  const app = new Hono<HonoEnv>();

  app.use(
    "*",
    createAuthenticationMiddleware({
      requiredPermissions: [permissions.knowledgeRead],
      verifyApiKey,
      verifySessionCookie,
    }),
  );
  app.get("/", (c) => c.json({ tenant: getTenant(c) }));

  const response = await app.request("http://localhost/", {
    headers: { cookie: "better-auth.session_token=valid" },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ tenant: "organization:org2" });
  expect(verifyApiKey.executeCalls).toEqual([]);
  expect(verifySessionCookie.executeCalls).toEqual([
    {
      cookieHeader: "better-auth.session_token=valid",
      requiredPermissions: [permissions.knowledgeRead],
    },
  ]);
});

test("createAuthenticationMiddleware: given an invalid session cookie, it should return 401", async () => {
  const app = new Hono();

  app.use(
    "*",
    createAuthenticationMiddleware({
      requiredPermissions: [permissions.knowledgeRead],
      verifyApiKey: new FakeVerifyApiKey(Promise.resolve(apiKeyPrincipal)),
      verifySessionCookie: new FakeVerifySessionCookie(
        Promise.reject(createInvalidSessionCookieError("Invalid session")),
      ),
    }),
  );
  app.get("/", (c) => c.json({ ok: true }));

  const response = await app.request("http://localhost/", {
    headers: { cookie: "better-auth.session_token=invalid" },
  });

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ message: "Unauthorized" });
});

test("createAuthenticationMiddleware: given insufficient permissions, it should return 403", async () => {
  const app = new Hono();

  app.use(
    "*",
    createAuthenticationMiddleware({
      requiredPermissions: [permissions.ingestionWrite],
      verifyApiKey: new FakeVerifyApiKey(Promise.resolve(apiKeyPrincipal)),
      verifySessionCookie: new FakeVerifySessionCookie(
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
    headers: { cookie: "better-auth.session_token=readonly" },
  });

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ message: "Forbidden" });
});
