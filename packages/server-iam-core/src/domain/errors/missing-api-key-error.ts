import { defineError } from "@repo/server-kernel";

const createMissingApiKeyError = defineError("MissingApiKey", "forbidden");
type MissingApiKeyError = ReturnType<typeof createMissingApiKeyError>;

export { createMissingApiKeyError };
export type { MissingApiKeyError };
