import type { Permission } from "../../../domain/permission.ts";
import type { Principal } from "../../../domain/principal.ts";

type ApiKeyVerifierPortVerifyInput = {
  readonly apiKey: string;
  readonly requiredPermissions: readonly Permission[];
};

type ApiKeyVerifierPortVerifyOutput = Promise<Principal>;

interface ApiKeyVerifierPort {
  verify(input: ApiKeyVerifierPortVerifyInput): ApiKeyVerifierPortVerifyOutput;
}

export type {
  ApiKeyVerifierPort,
  ApiKeyVerifierPortVerifyInput,
  ApiKeyVerifierPortVerifyOutput,
};
