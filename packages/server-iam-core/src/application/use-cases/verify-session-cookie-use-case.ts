import { AppError } from "@repo/app-error";

import type {
  VerifySessionCookiePort,
  VerifySessionCookiePortInput,
  VerifySessionCookiePortOutput,
} from "../ports/inbound/verify-session-cookie-port.ts";
import type { SessionCookieVerifierPort } from "../ports/outbound/session-cookie-verifier-port.ts";

class VerifySessionCookieUseCase implements VerifySessionCookiePort {
  constructor(
    private readonly sessionCookieVerifier: SessionCookieVerifierPort,
  ) {}

  async execute(
    input: VerifySessionCookiePortInput,
  ): VerifySessionCookiePortOutput {
    const cookieHeader = input.cookieHeader?.trim();

    if (cookieHeader === undefined || cookieHeader.length === 0) {
      throw AppError.ofCode("serverIamCore.missingSessionCookie", {
        message: "Missing session cookie",
      });
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
      throw AppError.ofCode("serverIamCore.insufficientPermission", {
        details: { permissions: missingPermissions },
        message: "Session does not grant the required permissions",
      });
    }

    return principal;
  }
}

export { VerifySessionCookieUseCase };
