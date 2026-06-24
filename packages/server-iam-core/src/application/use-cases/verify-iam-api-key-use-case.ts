import type {
  VerifyIamApiKeyPort,
  VerifyIamApiKeyPortInput,
  VerifyIamApiKeyPortOutput,
} from "../ports/inbound/verify-iam-api-key-port.ts";
import type { IamApiKeyVerifierPort } from "../ports/outbound/iam-api-key-verifier-port.ts";

import { createInsufficientIamPermissionError } from "../../domain/errors/insufficient-iam-permission-error.ts";
import { createMissingIamApiKeyError } from "../../domain/errors/missing-iam-api-key-error.ts";

class VerifyIamApiKeyUseCase implements VerifyIamApiKeyPort {
  constructor(private readonly iamApiKeyVerifier: IamApiKeyVerifierPort) {}

  async execute(input: VerifyIamApiKeyPortInput): VerifyIamApiKeyPortOutput {
    const apiKey = input.apiKey?.trim();

    if (apiKey === undefined || apiKey.length === 0) {
      throw createMissingIamApiKeyError("Missing IAM API key");
    }

    const principal = await this.iamApiKeyVerifier.verify({
      apiKey,
      requiredPermissions: input.requiredPermissions,
    });

    const missingPermissions = input.requiredPermissions.filter(
      (requiredPermission) =>
        !principal.permissions.includes(requiredPermission),
    );

    if (missingPermissions.length > 0) {
      throw createInsufficientIamPermissionError(
        "IAM API key does not grant the required permissions",
        { permissions: missingPermissions },
      );
    }

    return principal;
  }
}

export { VerifyIamApiKeyUseCase };
