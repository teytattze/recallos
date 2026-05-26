import { defineError } from "@repo/server-kernel";

export const InvalidKnowledgeGraphEdge = defineError(
  "InvalidKnowledgeGraphEdge",
  "validation",
);
export type InvalidKnowledgeGraphEdge = ReturnType<
  typeof InvalidKnowledgeGraphEdge
>;
