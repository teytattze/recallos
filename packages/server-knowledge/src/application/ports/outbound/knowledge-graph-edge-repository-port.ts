import type { KnowledgeGraphEdge } from "../../../domain/aggregates/knowledge-graph-edge.ts";
import type { EdgeId } from "../../../domain/value-objects/edge-id.ts";

interface KnowledgeGraphEdgeRepositoryPort {
  findById(id: EdgeId): Promise<KnowledgeGraphEdge | null>;
  findByIds(ids: EdgeId[]): Promise<KnowledgeGraphEdge[]>;
  save(edge: KnowledgeGraphEdge): Promise<void>;
  saveMany(edges: KnowledgeGraphEdge[]): Promise<void>;
}

export type { KnowledgeGraphEdgeRepositoryPort };
