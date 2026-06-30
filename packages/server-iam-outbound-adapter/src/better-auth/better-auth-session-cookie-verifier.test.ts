import { permissions } from "@repo/server-iam-core";
import { expect, test } from "bun:test";

import type {
  BetterAuthHasPermissionResult,
  BetterAuthSession,
  BetterAuthSessionCookieApi,
} from "./better-auth-session-cookie-verifier.ts";

import { BetterAuthSessionCookieVerifier } from "./better-auth-session-cookie-verifier.ts";

class FakeBetterAuthApi implements BetterAuthSessionCookieApi {
  readonly getSessionCalls: Parameters<
    BetterAuthSessionCookieApi["getSession"]
  >[] = [];
  readonly hasPermissionCalls: Parameters<
    BetterAuthSessionCookieApi["hasPermission"]
  >[] = [];

  constructor(
    private readonly sessionOutput: BetterAuthSession | null,
    private readonly hasPermissionOutput: BetterAuthHasPermissionResult,
  ) {}

  getSession(
    input: Parameters<BetterAuthSessionCookieApi["getSession"]>[0],
  ): Promise<BetterAuthSession | null> {
    this.getSessionCalls.push([input]);
    return Promise.resolve(this.sessionOutput);
  }

  hasPermission(
    input: Parameters<BetterAuthSessionCookieApi["hasPermission"]>[0],
  ): Promise<BetterAuthHasPermissionResult> {
    this.hasPermissionCalls.push([input]);
    return Promise.resolve(this.hasPermissionOutput);
  }
}

test("BetterAuthSessionCookieVerifier.verify: given a valid session with permission, it should return a principal", async () => {
  const api = new FakeBetterAuthApi(
    {
      session: {
        id: "session1",
        userId: "user1",
        activeOrganizationId: "org1",
      },
      user: { id: "user1" },
    },
    { success: true },
  );
  const verifier = new BetterAuthSessionCookieVerifier({ api });

  expect(
    await verifier.verify({
      cookieHeader: "better-auth.session_token=valid",
      requiredPermissions: [permissions.knowledgeRead],
    }),
  ).toEqual({
    tenant: "organization:org1",
    organizationId: "org1",
    authenticationMethod: "session-cookie",
    sessionId: "session1",
    userId: "user1",
    permissions: [permissions.knowledgeRead],
  });
  expect(api.getSessionCalls).toHaveLength(1);
  expect(api.getSessionCalls[0]![0].headers.get("cookie")).toBe(
    "better-auth.session_token=valid",
  );
  expect(api.getSessionCalls[0]![0].query).toEqual({
    disableCookieCache: true,
  });
  expect(api.hasPermissionCalls).toHaveLength(1);
  expect(api.hasPermissionCalls[0]![0].headers.get("cookie")).toBe(
    "better-auth.session_token=valid",
  );
  expect(api.hasPermissionCalls[0]![0].body).toEqual({
    organizationId: "org1",
    permissions: { knowledge: ["read"] },
  });
});

test("BetterAuthSessionCookieVerifier.verify: given an invalid session, it should throw an error", async () => {
  const verifier = new BetterAuthSessionCookieVerifier({
    api: new FakeBetterAuthApi(null, { success: false }),
  });

  try {
    await verifier.verify({
      cookieHeader: "better-auth.session_token=invalid",
      requiredPermissions: [permissions.knowledgeRead],
    });
    throw new Error("Expected invalid session cookie error");
  } catch (error) {
    expect(error).toMatchObject({ kind: "InvalidSessionCookie" });
  }
});

test("BetterAuthSessionCookieVerifier.verify: given a session without an active organization, it should throw an error", async () => {
  const verifier = new BetterAuthSessionCookieVerifier({
    api: new FakeBetterAuthApi(
      {
        session: {
          id: "session1",
          userId: "user1",
        },
        user: { id: "user1" },
      },
      { success: true },
    ),
  });

  try {
    await verifier.verify({
      cookieHeader: "better-auth.session_token=valid",
      requiredPermissions: [permissions.knowledgeRead],
    });
    throw new Error("Expected invalid session cookie error");
  } catch (error) {
    expect(error).toMatchObject({ kind: "InvalidSessionCookie" });
  }
});

test("BetterAuthSessionCookieVerifier.verify: given a session without permission, it should return a principal without verified permissions", async () => {
  const verifier = new BetterAuthSessionCookieVerifier({
    api: new FakeBetterAuthApi(
      {
        session: {
          id: "session1",
          userId: "user1",
          activeOrganizationId: "org1",
        },
        user: { id: "user1" },
      },
      { success: false },
    ),
  });

  expect(
    await verifier.verify({
      cookieHeader: "better-auth.session_token=readonly",
      requiredPermissions: [permissions.ingestionWrite],
    }),
  ).toEqual({
    tenant: "organization:org1",
    organizationId: "org1",
    authenticationMethod: "session-cookie",
    sessionId: "session1",
    userId: "user1",
    permissions: [],
  });
});
