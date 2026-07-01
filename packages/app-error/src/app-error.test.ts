import { expect, test } from "bun:test";

import { AppError, type AppErrorCode } from "./app-error.ts";

const iamErrorCodes = [
  "serverIamCore.missingApiKey",
  "serverIamCore.invalidApiKey",
  "serverIamCore.missingSessionCookie",
  "serverIamCore.invalidSessionCookie",
  "serverIamCore.insufficientPermission",
] as const satisfies readonly AppErrorCode[];

test("AppError.ofCode: given IAM error codes, it should create recognized app errors", () => {
  for (const code of iamErrorCodes) {
    expect(AppError.ofCode(code).code).toBe(code);
  }
});

test("AppError.ofCode: given options, it should expose stable metadata", () => {
  const error = AppError.ofCode("serverIamCore.insufficientPermission", {
    details: { permissions: ["knowledge:read"] },
    message: "API key does not grant the required permissions",
  });

  expect(error.code).toBe("serverIamCore.insufficientPermission");
  expect(error.details).toEqual({ permissions: ["knowledge:read"] });
  expect(error.httpStatus).toBe(403);
  expect(error.message).toBe("API key does not grant the required permissions");
  expect(error.publicMessage).toBe("Forbidden");
});

test("AppError.from: given serialized app error JSON, it should restore the code and details", () => {
  const error = AppError.from({
    code: "serverIamCore.invalidApiKey",
    details: { source: "test" },
    message: "Invalid API key",
  });

  expect(error.code).toBe("serverIamCore.invalidApiKey");
  expect(error.details).toEqual({ source: "test" });
  expect(error.httpStatus).toBe(401);
  expect(error.message).toBe("Invalid API key");
  expect(error.publicMessage).toBe("Unauthorized");
});
