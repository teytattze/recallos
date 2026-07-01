import { expect, test } from "bun:test";

import type {
  ApiKeyVerifierPort,
  ApiKeyVerifierPortVerifyInput,
  ApiKeyVerifierPortVerifyOutput,
} from "../ports/outbound/api-key-verifier-port.ts";

import { createInvalidApiKeyError } from "../../domain/errors/invalid-api-key-error.ts";
import { permissions } from "../../domain/permission.ts";
import { VerifyApiKeyUseCase } from "./verify-api-key-use-case.ts";

const principal = {
  tenant: "organization:org1",
  organizationId: "org1",
  authenticationMethod: "api-key",
  apiKeyId: "key1",
  permissions: [permissions.knowledgeRead],
} as const;

class FakeApiKeyVerifier implements ApiKeyVerifierPort {
  readonly verifyCalls: ApiKeyVerifierPortVerifyInput[] = [];

  constructor(private readonly output: ApiKeyVerifierPortVerifyOutput) {}

  verify(input: ApiKeyVerifierPortVerifyInput): ApiKeyVerifierPortVerifyOutput {
    this.verifyCalls.push(input);
    return this.output;
  }
}

test("VerifyApiKeyUseCase.execute: given a missing API key, it should throw without calling the verifier", async () => {
  const verifier = new FakeApiKeyVerifier(Promise.resolve(principal));
  const useCase = new VerifyApiKeyUseCase(verifier);

  try {
    await useCase.execute({
      apiKey: undefined,
      requiredPermissions: [permissions.knowledgeRead],
    });
    throw new Error("Expected missing API key error");
  } catch (error) {
    expect(error).toMatchObject({ kind: "MissingApiKey" });
  }
  expect(verifier.verifyCalls).toEqual([]);
});

test("VerifyApiKeyUseCase.execute: given an invalid API key, it should surface the verifier failure", async () => {
  const verifier = new FakeApiKeyVerifier(
    Promise.reject(createInvalidApiKeyError("Invalid API key")),
  );
  const useCase = new VerifyApiKeyUseCase(verifier);

  try {
    await useCase.execute({
      apiKey: "rcl_invalid",
      requiredPermissions: [permissions.knowledgeRead],
    });
    throw new Error("Expected invalid API key error");
  } catch (error) {
    expect(error).toMatchObject({ kind: "InvalidApiKey" });
  }
});

test("VerifyApiKeyUseCase.execute: given a key missing a required permission, it should throw", async () => {
  const verifier = new FakeApiKeyVerifier(Promise.resolve(principal));
  const useCase = new VerifyApiKeyUseCase(verifier);

  try {
    await useCase.execute({
      apiKey: "rcl_valid",
      requiredPermissions: [permissions.ingestionWrite],
    });
    throw new Error("Expected insufficient permission error");
  } catch (error) {
    expect(error).toMatchObject({ kind: "InsufficientPermission" });
  }
});

test("VerifyApiKeyUseCase.execute: given a key with the required permission, it should return the principal", async () => {
  const verifier = new FakeApiKeyVerifier(Promise.resolve(principal));
  const useCase = new VerifyApiKeyUseCase(verifier);

  expect(
    await useCase.execute({
      apiKey: " rcl_valid ",
      requiredPermissions: [permissions.knowledgeRead],
    }),
  ).toEqual(principal);
  expect(verifier.verifyCalls).toEqual([
    {
      apiKey: "rcl_valid",
      requiredPermissions: [permissions.knowledgeRead],
    },
  ]);
});
