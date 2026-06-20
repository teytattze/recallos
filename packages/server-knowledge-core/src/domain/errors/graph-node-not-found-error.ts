import { defineError } from "@repo/server-kernel";

const createGraphNodeNotFoundError = defineError(
  "GraphNodeNotFound",
  "not-found",
);
type GraphNodeNotFoundError = ReturnType<typeof createGraphNodeNotFoundError>;

export { createGraphNodeNotFoundError };
export type { GraphNodeNotFoundError };
