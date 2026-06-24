import { defineError } from "@repo/server-kernel";

const createInvalidIamApiKeyError = defineError(
  "InvalidIamApiKey",
  "forbidden",
);
type InvalidIamApiKeyError = ReturnType<typeof createInvalidIamApiKeyError>;

export { createInvalidIamApiKeyError };
export type { InvalidIamApiKeyError };
