import type {
  VerifySessionCookiePort,
  VerifySessionCookiePortInput,
  VerifySessionCookiePortOutput,
} from "../ports/inbound/verify-session-cookie-port.ts";
import type { SessionCookieVerifierPort } from "../ports/outbound/session-cookie-verifier-port.ts";

import { createInsufficientPermissionError } from "../../domain/errors/insufficient-permission-error.ts";
import { createMissingSessionCookieError } from "../../domain/errors/missing-session-cookie-error.ts";

class VerifySessionCookieUseCase implements VerifySessionCookiePort {
  constructor(
    private readonly sessionCookieVerifier: SessionCookieVerifierPort,
  ) {}

  async execute(
    input: VerifySessionCookiePortInput,
  ): VerifySessionCookiePortOutput {
    const cookieHeader = input.cookieHeader?.trim();

    if (cookieHeader === undefined || cookieHeader.length === 0) {
      throw createMissingSessionCookieError("Missing session cookie");
    }

    const principal = await this.sessionCookieVerifier.verify({
      cookieHeader,
      requiredPermissions: input.requiredPermissions,
    });

    const missingPermissions = input.requiredPermissions.filter(
      (requiredPermission) =>
        !principal.permissions.includes(requiredPermission),
    );

    if (missingPermissions.length > 0) {
      throw createInsufficientPermissionError(
        "Session does not grant the required permissions",
        { permissions: missingPermissions },
      );
    }

    return principal;
  }
}

export { VerifySessionCookieUseCase };
