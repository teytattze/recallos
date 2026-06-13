import { defineError } from "@repo/server-kernel";

const createInvalidGraphEdgeError = defineError(
  "InvalidGraphEdge",
  "validation",
);
type InvalidGraphEdgeError = ReturnType<
  typeof createInvalidGraphEdgeError
>;

export { createInvalidGraphEdgeError };
export type { InvalidGraphEdgeError };
