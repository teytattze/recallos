import { defineError } from "@repo/server-kernel";

export const InvalidKnowledgeGraphNode = defineError(
  "InvalidKnowledgeGraphNode",
  "validation",
);
export type InvalidKnowledgeGraphNode = ReturnType<
  typeof InvalidKnowledgeGraphNode
>;
