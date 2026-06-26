import type { Permission } from "../../../domain/permission.ts";
import type { Principal } from "../../../domain/principal.ts";

type VerifyApiKeyPortInput = {
  readonly apiKey: string | undefined;
  readonly requiredPermissions: readonly Permission[];
};

type VerifyApiKeyPortOutput = Promise<Principal>;

interface VerifyApiKeyPort {
  execute(input: VerifyApiKeyPortInput): VerifyApiKeyPortOutput;
}

export type { VerifyApiKeyPort, VerifyApiKeyPortInput, VerifyApiKeyPortOutput };
