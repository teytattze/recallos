import { defineError } from "@repo/server-kernel";

const createInvalidKnowledgeGraphNodeError = defineError(
  "InvalidKnowledgeGraphNode",
  "validation",
);
type InvalidKnowledgeGraphNodeError = ReturnType<
  typeof createInvalidKnowledgeGraphNodeError
>;

export { createInvalidKnowledgeGraphNodeError };
export type { InvalidKnowledgeGraphNodeError };
