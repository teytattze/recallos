import type { Tenant } from "@repo/server-kernel";

import type { GraphNode } from "../../../domain/aggregates/graph-node.ts";

interface GraphNodeRepositoryPort {
  searchByEmbedding(input: {
    tenant: Tenant;
    payload: { embedding: number[][] };
  }): Promise<GraphNode[]>;
  insert(input: { payload: GraphNode }): Promise<void>;
}

export type { GraphNodeRepositoryPort };
