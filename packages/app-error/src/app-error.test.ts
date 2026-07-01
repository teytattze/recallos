import { expect, test } from "bun:test";

import { AppError, type AppErrorCode } from "./app-error.ts";

const iamErrorCodes = [
  "serverIamCore.missingApiKey",
  "serverIamCore.invalidApiKey",
  "serverIamCore.missingSessionCookie",
  "serverIamCore.invalidSessionCookie",
  "serverIamCore.insufficientPermission",
] as const satisfies readonly AppErrorCode[];

const serverErrorCodes = [
  "invariantViolation",
  "serverIngestionCore.invalidWebhookAuthentication",
  "serverIngestionCore.webhookSubscriptionNotFound",
  "serverKnowledgeCore.graphNotFound",
] as const satisfies readonly AppErrorCode[];

test("AppError.ofCode: given IAM error codes, it should create recognized app errors", () => {
  for (const code of iamErrorCodes) {
    expect(AppError.ofCode(code).code).toBe(code);
  }
});

test("AppError.ofCode: given server error codes, it should create recognized app errors", () => {
  for (const code of serverErrorCodes) {
    expect(AppError.ofCode(code).code).toBe(code);
  }
});

test("AppError.ofCode: given cause and message options, it should apply them to the error", () => {
  const cause = new Error("underlying failure");

  const error = AppError.ofCode("serverIamCore.insufficientPermission", {
    cause,
    message: "API key does not grant the required permissions",
  });

  expect(error.code).toBe("serverIamCore.insufficientPermission");
  expect(error.httpStatus).toBe(403);
  expect(error.message).toBe("API key does not grant the required permissions");
  expect(error.cause).toBe(cause);
});

test("AppError.from: given serialized app error JSON, it should restore the code and message", () => {
  const error = AppError.from({
    code: "serverIamCore.invalidApiKey",
    message: "Invalid API key",
  });

  expect(error.code).toBe("serverIamCore.invalidApiKey");
  expect(error.httpStatus).toBe(401);
  expect(error.message).toBe("Invalid API key");
  expect(error.toJSON()).toEqual({
    code: "serverIamCore.invalidApiKey",
    message: "Invalid API key",
  });
});
