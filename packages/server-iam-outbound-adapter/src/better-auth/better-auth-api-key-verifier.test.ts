import { permissions } from "@repo/server-iam-core";
import { expect, test } from "bun:test";

import type {
  BetterAuthApiKeyApi,
  BetterAuthVerifyApiKeyResult,
} from "./better-auth-api-key-verifier.ts";

import { BetterAuthApiKeyVerifier } from "./better-auth-api-key-verifier.ts";

class FakeBetterAuthApi implements BetterAuthApiKeyApi {
  readonly verifyApiKeyCalls: Parameters<
    BetterAuthApiKeyApi["verifyApiKey"]
  >[] = [];

  constructor(private readonly output: BetterAuthVerifyApiKeyResult) {}

  verifyApiKey(
    input: Parameters<BetterAuthApiKeyApi["verifyApiKey"]>[0],
  ): Promise<BetterAuthVerifyApiKeyResult> {
    this.verifyApiKeyCalls.push([input]);
    return Promise.resolve(this.output);
  }
}

test("BetterAuthApiKeyVerifier.verify: given a valid org-owned key, it should return a principal", async () => {
  const api = new FakeBetterAuthApi({
    valid: true,
    key: {
      id: "key1",
      referenceId: "org1",
      permissions: { knowledge: ["read"] },
    },
  });
  const verifier = new BetterAuthApiKeyVerifier({
    api,
    configId: "org-keys",
  });

  expect(
    await verifier.verify({
      apiKey: "rcl_valid",
      requiredPermissions: [permissions.knowledgeRead],
    }),
  ).toEqual({
    tenant: "organization:org1",
    organizationId: "org1",
    authenticationMethod: "api-key",
    apiKeyId: "key1",
    permissions: [permissions.knowledgeRead],
  });
  expect(api.verifyApiKeyCalls).toEqual([
    [
      {
        body: {
          key: "rcl_valid",
          configId: "org-keys",
          permissions: { knowledge: ["read"] },
        },
      },
    ],
  ]);
});

test("BetterAuthApiKeyVerifier.verify: given an invalid key, it should throw an error", async () => {
  const verifier = new BetterAuthApiKeyVerifier({
    api: new FakeBetterAuthApi({ valid: false, key: null }),
    configId: "org-keys",
  });

  try {
    await verifier.verify({
      apiKey: "rcl_invalid",
      requiredPermissions: [permissions.knowledgeRead],
    });
    throw new Error("Expected invalid API key error");
  } catch (error) {
    expect(error).toMatchObject({ kind: "InvalidApiKey" });
  }
});

test("BetterAuthApiKeyVerifier.verify: given a user-owned key, it should throw an error", async () => {
  const verifier = new BetterAuthApiKeyVerifier({
    api: new FakeBetterAuthApi({
      valid: true,
      key: { id: "key1", permissions: { knowledge: ["read"] } },
    }),
    configId: "org-keys",
  });

  try {
    await verifier.verify({
      apiKey: "rcl_user",
      requiredPermissions: [permissions.knowledgeRead],
    });
    throw new Error("Expected invalid API key error");
  } catch (error) {
    expect(error).toMatchObject({ kind: "InvalidApiKey" });
  }
});
