import { defineError } from "@repo/server-kernel";

export const InvalidKnowledgeGraph = defineError(
  "InvalidKnowledgeGraph",
  "validation",
);
export type InvalidKnowledgeGraph = ReturnType<typeof InvalidKnowledgeGraph>;
