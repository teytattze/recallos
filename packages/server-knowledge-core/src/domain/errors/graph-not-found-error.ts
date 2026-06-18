import { defineError } from "@repo/server-kernel";

const createGraphNotFoundError = defineError("GraphNotFound", "not-found");
type GraphNotFoundError = ReturnType<typeof createGraphNotFoundError>;

export { createGraphNotFoundError };
export type { GraphNotFoundError };
