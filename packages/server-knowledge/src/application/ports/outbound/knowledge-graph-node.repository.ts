import type { KnowledgeGraphId } from "../../../domain/knowledge-graph-id.value-object.ts";
import type { KnowledgeGraphNode } from "../../../domain/knowledge-graph-node.aggregate.ts";
import type { NodeId } from "../../../domain/node-id.value-object.ts";
import type { NodeType } from "../../../domain/node-type.value-object.ts";

export interface KnowledgeGraphNodeRepository {
  findById(id: NodeId): Promise<KnowledgeGraphNode | null>;
  findByIds(ids: NodeId[]): Promise<KnowledgeGraphNode[]>;
  findByNaturalKey(
    graphId: KnowledgeGraphId,
    type: NodeType,
    key: string,
  ): Promise<KnowledgeGraphNode | null>;
  /** Nodes still missing an embedding — the work list for `EmbedNodes` (§12). */
  findNeedingEmbedding(limit: number): Promise<KnowledgeGraphNode[]>;
  saveMany(nodes: KnowledgeGraphNode[]): Promise<void>;
}
