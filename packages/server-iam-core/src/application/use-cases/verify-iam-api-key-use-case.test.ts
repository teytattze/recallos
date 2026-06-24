import { expect, test } from "bun:test";

import type {
  IamApiKeyVerifierPort,
  IamApiKeyVerifierPortVerifyInput,
  IamApiKeyVerifierPortVerifyOutput,
} from "../ports/outbound/iam-api-key-verifier-port.ts";

import { createInvalidIamApiKeyError } from "../../domain/errors/invalid-iam-api-key-error.ts";
import { iamPermissions } from "../../domain/iam-permission.ts";
import { VerifyIamApiKeyUseCase } from "./verify-iam-api-key-use-case.ts";

const principal = {
  tenant: "organization:org1",
  organizationId: "org1",
  apiKeyId: "key1",
  permissions: [iamPermissions.knowledgeRead],
};

class FakeIamApiKeyVerifier implements IamApiKeyVerifierPort {
  readonly verifyCalls: IamApiKeyVerifierPortVerifyInput[] = [];

  constructor(private readonly output: IamApiKeyVerifierPortVerifyOutput) {}

  verify(
    input: IamApiKeyVerifierPortVerifyInput,
  ): IamApiKeyVerifierPortVerifyOutput {
    this.verifyCalls.push(input);
    return this.output;
  }
}

test("VerifyIamApiKeyUseCase.execute: given a missing API key, it should throw without calling the verifier", async () => {
  const verifier = new FakeIamApiKeyVerifier(Promise.resolve(principal));
  const useCase = new VerifyIamApiKeyUseCase(verifier);

  try {
    await useCase.execute({
      apiKey: undefined,
      requiredPermissions: [iamPermissions.knowledgeRead],
    });
    throw new Error("Expected missing IAM API key error");
  } catch (error) {
    expect(error).toMatchObject({ kind: "MissingIamApiKey" });
  }
  expect(verifier.verifyCalls).toEqual([]);
});

test("VerifyIamApiKeyUseCase.execute: given an invalid API key, it should surface the verifier failure", async () => {
  const verifier = new FakeIamApiKeyVerifier(
    Promise.reject(createInvalidIamApiKeyError("Invalid IAM API key")),
  );
  const useCase = new VerifyIamApiKeyUseCase(verifier);

  try {
    await useCase.execute({
      apiKey: "rcl_invalid",
      requiredPermissions: [iamPermissions.knowledgeRead],
    });
    throw new Error("Expected invalid IAM API key error");
  } catch (error) {
    expect(error).toMatchObject({ kind: "InvalidIamApiKey" });
  }
});

test("VerifyIamApiKeyUseCase.execute: given a key missing a required permission, it should throw", async () => {
  const verifier = new FakeIamApiKeyVerifier(Promise.resolve(principal));
  const useCase = new VerifyIamApiKeyUseCase(verifier);

  try {
    await useCase.execute({
      apiKey: "rcl_valid",
      requiredPermissions: [iamPermissions.ingestionWrite],
    });
    throw new Error("Expected insufficient IAM permission error");
  } catch (error) {
    expect(error).toMatchObject({ kind: "InsufficientIamPermission" });
  }
});

test("VerifyIamApiKeyUseCase.execute: given a key with the required permission, it should return the principal", async () => {
  const verifier = new FakeIamApiKeyVerifier(Promise.resolve(principal));
  const useCase = new VerifyIamApiKeyUseCase(verifier);

  expect(
    await useCase.execute({
      apiKey: " rcl_valid ",
      requiredPermissions: [iamPermissions.knowledgeRead],
    }),
  ).toEqual(principal);
  expect(verifier.verifyCalls).toEqual([
    {
      apiKey: "rcl_valid",
      requiredPermissions: [iamPermissions.knowledgeRead],
    },
  ]);
});
