import type { KnowledgeGraphEdge } from "../../../domain/knowledge-graph-edge.aggregate.ts";
import type { KnowledgeGraphId } from "../../../domain/knowledge-graph-id.value-object.ts";
import type { NodeId } from "../../../domain/node-id.value-object.ts";
import type { RelationshipType } from "../../../domain/relationship-type.value-object.ts";

export interface KnowledgeGraphEdgeRepository {
  /** The `(from, to, relationship)` triple is unique per graph — the dedup key. */
  findByTriple(
    graphId: KnowledgeGraphId,
    fromId: NodeId,
    toId: NodeId,
    relationship: RelationshipType,
  ): Promise<KnowledgeGraphEdge | null>;
  /** Outstanding `DUPLICATE_OF` edges — the merge backlog for `MergeDuplicateNodes`. */
  findByRelationship(
    relationship: RelationshipType,
    limit: number,
  ): Promise<KnowledgeGraphEdge[]>;
  saveMany(edges: KnowledgeGraphEdge[]): Promise<void>;
  /** Re-point every edge incident to `from` onto `to` — used by merge. */
  repointIncidentEdges(from: NodeId, to: NodeId): Promise<void>;
  deleteMany(ids: KnowledgeGraphEdge[]): Promise<void>;
}
