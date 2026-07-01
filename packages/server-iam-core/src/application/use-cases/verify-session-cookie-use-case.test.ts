import { AppError, type AppErrorCode } from "@repo/app-error";
import { expect, test } from "bun:test";

import type {
  SessionCookieVerifierPort,
  SessionCookieVerifierPortVerifyInput,
  SessionCookieVerifierPortVerifyOutput,
} from "../ports/outbound/session-cookie-verifier-port.ts";

import { permissions } from "../../domain/permission.ts";
import { VerifySessionCookieUseCase } from "./verify-session-cookie-use-case.ts";

const principal = {
  tenant: "organization:org1",
  organizationId: "org1",
  authenticationMethod: "session-cookie",
  sessionId: "session1",
  userId: "user1",
  permissions: [permissions.knowledgeRead],
} as const;

class FakeSessionCookieVerifier implements SessionCookieVerifierPort {
  readonly verifyCalls: SessionCookieVerifierPortVerifyInput[] = [];

  constructor(private readonly output: SessionCookieVerifierPortVerifyOutput) {}

  verify(
    input: SessionCookieVerifierPortVerifyInput,
  ): SessionCookieVerifierPortVerifyOutput {
    this.verifyCalls.push(input);
    return this.output;
  }
}

const expectAppErrorCode = (error: unknown, code: AppErrorCode) => {
  expect(error).toBeInstanceOf(AppError);
  expect(AppError.from(error).code).toBe(code);
};

test("VerifySessionCookieUseCase.execute: given a missing cookie header, it should throw without calling the verifier", async () => {
  const verifier = new FakeSessionCookieVerifier(Promise.resolve(principal));
  const useCase = new VerifySessionCookieUseCase(verifier);

  try {
    await useCase.execute({
      cookieHeader: undefined,
      requiredPermissions: [permissions.knowledgeRead],
    });
    throw new Error("Expected missing session cookie error");
  } catch (error) {
    expectAppErrorCode(error, "serverIamCore.missingSessionCookie");
  }
  expect(verifier.verifyCalls).toEqual([]);
});

test("VerifySessionCookieUseCase.execute: given an invalid session cookie, it should surface the verifier failure", async () => {
  const verifier = new FakeSessionCookieVerifier(
    Promise.reject(
      AppError.ofCode("serverIamCore.invalidSessionCookie", {
        message: "Invalid session cookie",
      }),
    ),
  );
  const useCase = new VerifySessionCookieUseCase(verifier);

  try {
    await useCase.execute({
      cookieHeader: "better-auth.session_token=invalid",
      requiredPermissions: [permissions.knowledgeRead],
    });
    throw new Error("Expected invalid session cookie error");
  } catch (error) {
    expectAppErrorCode(error, "serverIamCore.invalidSessionCookie");
  }
});

test("VerifySessionCookieUseCase.execute: given a session missing a required permission, it should throw", async () => {
  const verifier = new FakeSessionCookieVerifier(Promise.resolve(principal));
  const useCase = new VerifySessionCookieUseCase(verifier);

  try {
    await useCase.execute({
      cookieHeader: "better-auth.session_token=valid",
      requiredPermissions: [permissions.ingestionWrite],
    });
    throw new Error("Expected insufficient permission error");
  } catch (error) {
    expectAppErrorCode(error, "serverIamCore.insufficientPermission");
  }
});

test("VerifySessionCookieUseCase.execute: given a session with the required permission, it should return the principal", async () => {
  const verifier = new FakeSessionCookieVerifier(Promise.resolve(principal));
  const useCase = new VerifySessionCookieUseCase(verifier);

  expect(
    await useCase.execute({
      cookieHeader: " better-auth.session_token=valid ",
      requiredPermissions: [permissions.knowledgeRead],
    }),
  ).toEqual(principal);
  expect(verifier.verifyCalls).toEqual([
    {
      cookieHeader: "better-auth.session_token=valid",
      requiredPermissions: [permissions.knowledgeRead],
    },
  ]);
});
