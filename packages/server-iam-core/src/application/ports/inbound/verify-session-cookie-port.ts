import type { Permission } from "../../../domain/permission.ts";
import type { Principal } from "../../../domain/principal.ts";

type VerifySessionCookiePortInput = {
  readonly cookieHeader: string | undefined;
  readonly requiredPermissions: readonly Permission[];
};

type VerifySessionCookiePortOutput = Promise<Principal>;

interface VerifySessionCookiePort {
  execute(input: VerifySessionCookiePortInput): VerifySessionCookiePortOutput;
}

export type {
  VerifySessionCookiePort,
  VerifySessionCookiePortInput,
  VerifySessionCookiePortOutput,
};
