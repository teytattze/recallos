import { defineError } from "@repo/server-kernel";

const createMissingIamApiKeyError = defineError(
  "MissingIamApiKey",
  "forbidden",
);
type MissingIamApiKeyError = ReturnType<typeof createMissingIamApiKeyError>;

export { createMissingIamApiKeyError };
export type { MissingIamApiKeyError };
