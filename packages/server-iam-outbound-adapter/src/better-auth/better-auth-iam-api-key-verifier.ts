import type {
  IamApiKeyVerifierPort,
  IamApiKeyVerifierPortVerifyInput,
  IamApiKeyVerifierPortVerifyOutput,
  IamPermission,
} from "@repo/server-iam-core";

import { createInvalidIamApiKeyError } from "@repo/server-iam-core";
import { Tenant } from "@repo/server-kernel";

import {
  fromBetterAuthPermissionRecord,
  toBetterAuthPermissionRecord,
} from "./iam-permission-record.ts";

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

type BetterAuthIamApiKeyVerifierInput = {
  readonly api: BetterAuthApiKeyApi;
  readonly configId: string;
};

class BetterAuthIamApiKeyVerifier implements IamApiKeyVerifierPort {
  constructor(private readonly input: BetterAuthIamApiKeyVerifierInput) {}

  async verify(
    input: IamApiKeyVerifierPortVerifyInput,
  ): IamApiKeyVerifierPortVerifyOutput {
    const result = await this.input.api.verifyApiKey({
      body: {
        key: input.apiKey,
        configId: this.input.configId,
        permissions: toBetterAuthPermissionRecord(input.requiredPermissions),
      },
    });

    if (!result.valid || result.key === null) {
      throw createInvalidIamApiKeyError("Invalid IAM API key");
    }

    const organizationId = result.key.referenceId;

    if (organizationId === undefined || organizationId.length === 0) {
      throw createInvalidIamApiKeyError(
        "IAM API key is not organization-owned",
      );
    }

    return {
      tenant: Tenant.create("organization", organizationId).toString(),
      organizationId,
      apiKeyId: result.key.id,
      permissions: this.resolvePermissions({
        storedPermissions: result.key.permissions,
        verifiedPermissions: input.requiredPermissions,
      }),
    };
  }

  private resolvePermissions(input: {
    readonly storedPermissions: unknown;
    readonly verifiedPermissions: readonly IamPermission[];
  }): readonly IamPermission[] {
    const storedPermissions = fromBetterAuthPermissionRecord(
      input.storedPermissions,
    );

    if (storedPermissions.length > 0) return storedPermissions;

    return input.verifiedPermissions;
  }
}

export { BetterAuthIamApiKeyVerifier };
export type { BetterAuthApiKeyApi, BetterAuthVerifyApiKeyResult };
