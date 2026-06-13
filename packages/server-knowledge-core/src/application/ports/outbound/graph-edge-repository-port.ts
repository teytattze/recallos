import type { GraphEdge } from "../../../domain/aggregates/graph-edge.ts";

interface GraphEdgeRepositoryPort {
  insertMany(input: { payload: GraphEdge[] }): Promise<void>;
}

export type { GraphEdgeRepositoryPort };
