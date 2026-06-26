import { defineError } from "@repo/server-kernel";

const createInvalidApiKeyError = defineError("InvalidApiKey", "forbidden");
type InvalidApiKeyError = ReturnType<typeof createInvalidApiKeyError>;

export { createInvalidApiKeyError };
export type { InvalidApiKeyError };
