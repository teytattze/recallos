import type { Permission } from "../../../domain/permission.ts";
import type { Principal } from "../../../domain/principal.ts";

type SessionCookieVerifierPortVerifyInput = {
  readonly cookieHeader: string;
  readonly requiredPermissions: readonly Permission[];
};

type SessionCookieVerifierPortVerifyOutput = Promise<Principal>;

interface SessionCookieVerifierPort {
  verify(
    input: SessionCookieVerifierPortVerifyInput,
  ): SessionCookieVerifierPortVerifyOutput;
}

export type {
  SessionCookieVerifierPort,
  SessionCookieVerifierPortVerifyInput,
  SessionCookieVerifierPortVerifyOutput,
};
