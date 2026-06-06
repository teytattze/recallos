import { defineError } from "@repo/server-kernel";

const createInvalidKnowledgeGraphError = defineError(
  "InvalidKnowledgeGraph",
  "validation",
);
type InvalidKnowledgeGraphError = ReturnType<
  typeof createInvalidKnowledgeGraphError
>;

export { createInvalidKnowledgeGraphError };
export type { InvalidKnowledgeGraphError };
