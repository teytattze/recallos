import { defineError } from "@repo/server-kernel";

const createInvalidKnowledgeGraphEdgeError = defineError(
  "InvalidKnowledgeGraphEdge",
  "validation",
);
type InvalidKnowledgeGraphEdgeError = ReturnType<
  typeof createInvalidKnowledgeGraphEdgeError
>;

export { createInvalidKnowledgeGraphEdgeError };
export type { InvalidKnowledgeGraphEdgeError };
