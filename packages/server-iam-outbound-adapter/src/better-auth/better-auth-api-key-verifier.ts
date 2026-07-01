import type {
  ApiKeyVerifierPort,
  ApiKeyVerifierPortVerifyInput,
  ApiKeyVerifierPortVerifyOutput,
  Permission,
} from "@repo/server-iam-core";

import { AppError } from "@repo/app-error";
import { Tenant } from "@repo/server-kernel";

import {
  fromBetterAuthPermissionRecord,
  toBetterAuthPermissionRecord,
} from "./permission-record.ts";

type BetterAuthVerifyApiKeyResult = {
  readonly valid: boolean;
  readonly key: {
    readonly id: string;
    readonly referenceId?: string;
    readonly permissions?: unknown;
  } | null;
};

type BetterAuthApiKeyApi = {
  readonly verifyApiKey: (input: {
    readonly body: {
      readonly key: string;
      readonly configId: string;
      readonly permissions: Record<string, string[]>;
    };
  }) => Promise<BetterAuthVerifyApiKeyResult>;
};

type BetterAuthApiKeyVerifierInput = {
  readonly api: BetterAuthApiKeyApi;
  readonly configId: string;
};

class BetterAuthApiKeyVerifier implements ApiKeyVerifierPort {
  constructor(private readonly input: BetterAuthApiKeyVerifierInput) {}

  async verify(
    input: ApiKeyVerifierPortVerifyInput,
  ): ApiKeyVerifierPortVerifyOutput {
    const result = await this.input.api.verifyApiKey({
      body: {
        key: input.apiKey,
        configId: this.input.configId,
        permissions: toBetterAuthPermissionRecord(input.requiredPermissions),
      },
    });

    if (!result.valid || result.key === null) {
      throw AppError.ofCode("serverIamCore.invalidApiKey", {
        message: "Invalid API key",
      });
    }

    const organizationId = result.key.referenceId;

    if (organizationId === undefined || organizationId.length === 0) {
      throw AppError.ofCode("serverIamCore.invalidApiKey", {
        message: "API key is not organization-owned",
      });
    }

    return {
      tenant: Tenant.create("organization", organizationId).toString(),
      organizationId,
      authenticationMethod: "api-key",
      apiKeyId: result.key.id,
      permissions: this.resolvePermissions({
        storedPermissions: result.key.permissions,
        verifiedPermissions: input.requiredPermissions,
      }),
    };
  }

  private resolvePermissions(input: {
    readonly storedPermissions: unknown;
    readonly verifiedPermissions: readonly Permission[];
  }): readonly Permission[] {
    const storedPermissions = fromBetterAuthPermissionRecord(
      input.storedPermissions,
    );

    if (storedPermissions.length > 0) return storedPermissions;

    return input.verifiedPermissions;
  }
}

export { BetterAuthApiKeyVerifier };
export type { BetterAuthApiKeyApi, BetterAuthVerifyApiKeyResult };
