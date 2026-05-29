import type { Result } from "@repo/server-kernel";

import type { NodeId } from "../../../domain/node-id.value-object.ts";

export type EmbedNodesInput = {
  /** Specific nodes to embed (e.g. from `NodeCreated`); omit for a cron sweep. */
  nodeIds?: NodeId[];
  limit: number;
};

export type EmbedNodesReport = {
  embedded: number;
};

/** Assigns or refreshes embeddings for nodes that need one — split out so an
 *  embedding-API outage never wedges graph construction (§6/§12). */
export interface EmbedNodes {
  execute(input: EmbedNodesInput): Promise<Result<EmbedNodesReport>>;
}
