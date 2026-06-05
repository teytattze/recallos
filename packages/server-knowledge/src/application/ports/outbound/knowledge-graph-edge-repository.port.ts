import type { EdgeId } from "../../../domain/edge-id.value-object.ts";
import type { KnowledgeGraphEdge } from "../../../domain/knowledge-graph-edge.aggregate.ts";

export interface KnowledgeGraphEdgeRepositoryPort {
  findById(id: EdgeId): Promise<KnowledgeGraphEdge | null>;
  findByIds(ids: EdgeId[]): Promise<KnowledgeGraphEdge[]>;
  save(edge: KnowledgeGraphEdge): Promise<void>;
  saveMany(edges: KnowledgeGraphEdge[]): Promise<void>;
}
