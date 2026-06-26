import type {
  VerifyApiKeyPort,
  VerifyApiKeyPortInput,
  VerifyApiKeyPortOutput,
} from "../ports/inbound/verify-api-key-port.ts";
import type { ApiKeyVerifierPort } from "../ports/outbound/api-key-verifier-port.ts";

import { createInsufficientPermissionError } from "../../domain/errors/insufficient-permission-error.ts";
import { createMissingApiKeyError } from "../../domain/errors/missing-api-key-error.ts";

class VerifyApiKeyUseCase implements VerifyApiKeyPort {
  constructor(private readonly apiKeyVerifier: ApiKeyVerifierPort) {}

  async execute(input: VerifyApiKeyPortInput): VerifyApiKeyPortOutput {
    const apiKey = input.apiKey?.trim();

    if (apiKey === undefined || apiKey.length === 0) {
      throw createMissingApiKeyError("Missing API key");
    }

    const principal = await this.apiKeyVerifier.verify({
      apiKey,
      requiredPermissions: input.requiredPermissions,
    });

    const missingPermissions = input.requiredPermissions.filter(
      (requiredPermission) =>
        !principal.permissions.includes(requiredPermission),
    );

    if (missingPermissions.length > 0) {
      throw createInsufficientPermissionError(
        "API key does not grant the required permissions",
        { permissions: missingPermissions },
      );
    }

    return principal;
  }
}

export { VerifyApiKeyUseCase };
