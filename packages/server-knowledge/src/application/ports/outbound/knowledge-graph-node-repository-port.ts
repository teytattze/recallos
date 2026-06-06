import type { KnowledgeGraphNode } from "../../../domain/aggregates/knowledge-graph-node.ts";
import type { NodeId } from "../../../domain/value-objects/node-id.ts";

interface KnowledgeGraphNodeRepositoryPort {
  findById(id: NodeId): Promise<KnowledgeGraphNode | null>;
  findByIds(ids: NodeId[]): Promise<KnowledgeGraphNode[]>;
  save(node: KnowledgeGraphNode): Promise<void>;
  saveMany(nodes: KnowledgeGraphNode[]): Promise<void>;
}

export type { KnowledgeGraphNodeRepositoryPort };
