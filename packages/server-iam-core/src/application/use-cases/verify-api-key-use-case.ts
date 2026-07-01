import { AppError } from "@repo/app-error";

import type {
  VerifyApiKeyPort,
  VerifyApiKeyPortInput,
  VerifyApiKeyPortOutput,
} from "../ports/inbound/verify-api-key-port.ts";
import type { ApiKeyVerifierPort } from "../ports/outbound/api-key-verifier-port.ts";

class VerifyApiKeyUseCase implements VerifyApiKeyPort {
  constructor(private readonly apiKeyVerifier: ApiKeyVerifierPort) {}

  async execute(input: VerifyApiKeyPortInput): VerifyApiKeyPortOutput {
    const apiKey = input.apiKey?.trim();

    if (apiKey === undefined || apiKey.length === 0) {
      throw AppError.ofCode("serverIamCore.missingApiKey");
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
      throw AppError.ofCode("serverIamCore.insufficientPermission");
    }

    return principal;
  }
}

export { VerifyApiKeyUseCase };
