import type { IamPermission } from "../../../domain/iam-permission.ts";
import type { IamPrincipal } from "../../../domain/iam-principal.ts";

type VerifyIamApiKeyPortInput = {
  readonly apiKey: string | undefined;
  readonly requiredPermissions: readonly IamPermission[];
};

type VerifyIamApiKeyPortOutput = Promise<IamPrincipal>;

interface VerifyIamApiKeyPort {
  execute(input: VerifyIamApiKeyPortInput): VerifyIamApiKeyPortOutput;
}

export type {
  VerifyIamApiKeyPort,
  VerifyIamApiKeyPortInput,
  VerifyIamApiKeyPortOutput,
};
