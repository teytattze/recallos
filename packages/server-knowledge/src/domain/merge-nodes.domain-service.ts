import type { KnowledgeGraphNode } from "./knowledge-graph-node.aggregate.ts";

export type MergeNodesInput = {
  survivor: KnowledgeGraphNode;
  duplicate: KnowledgeGraphNode;
  now: Date;
};

/**
 * Fold a duplicate node into the survivor without deletion: provenance is unioned
 * via `attachEvents` so `eventIds` only ever grow. Re-pointing incident edges is
 * I/O and lives in the application/infra layer, not here.
 */
export const mergeNodes = ({ survivor, duplicate, now }: MergeNodesInput): void => {
  survivor.attachEvents(duplicate.eventIds, now);
};
