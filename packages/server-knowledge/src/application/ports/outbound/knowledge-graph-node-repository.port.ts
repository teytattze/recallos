import type { KnowledgeGraphNode } from "../../../domain/knowledge-graph-node.aggregate.ts";
import type { NodeId } from "../../../domain/node-id.value-object.ts";

export interface KnowledgeGraphNodeRepository {
  findById(id: NodeId): Promise<KnowledgeGraphNode | null>;
  findByIds(ids: NodeId[]): Promise<KnowledgeGraphNode[]>;
  save(node: KnowledgeGraphNode): Promise<void>;
  saveMany(nodes: KnowledgeGraphNode[]): Promise<void>;
}
