import type { IamPermission } from "../../../domain/iam-permission.ts";
import type { IamPrincipal } from "../../../domain/iam-principal.ts";

type IamApiKeyVerifierPortVerifyInput = {
  readonly apiKey: string;
  readonly requiredPermissions: readonly IamPermission[];
};

type IamApiKeyVerifierPortVerifyOutput = Promise<IamPrincipal>;

interface IamApiKeyVerifierPort {
  verify(
    input: IamApiKeyVerifierPortVerifyInput,
  ): IamApiKeyVerifierPortVerifyOutput;
}

export type {
  IamApiKeyVerifierPort,
  IamApiKeyVerifierPortVerifyInput,
  IamApiKeyVerifierPortVerifyOutput,
};
