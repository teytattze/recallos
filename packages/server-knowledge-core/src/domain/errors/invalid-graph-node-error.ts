import { defineError } from "@repo/server-kernel";

const createInvalidGraphNodeError = defineError(
  "InvalidGraphNode",
  "validation",
);
type InvalidGraphNodeError = ReturnType<
  typeof createInvalidGraphNodeError
>;

export { createInvalidGraphNodeError };
export type { InvalidGraphNodeError };
