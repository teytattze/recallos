import type { EdgeId, NodeId } from "./ids.value-object.ts";
import type { NodeType } from "./node-type.value-object.ts";
import type { RelationshipType } from "./relationship-type.value-object.ts";

export interface NodeView {
  readonly id: NodeId;
  readonly type: NodeType;
  readonly body: string;
}

export interface EdgeView {
  readonly id: EdgeId;
  readonly fromId: NodeId;
  readonly toId: NodeId;
  readonly relationship: RelationshipType;
  readonly confidence: number;
  readonly observedAt: Date;
}

/**
 * A bounded read result: a root node plus its n-hop neighborhood. The shape recall
 * returns — a read model assembled by a traversal port, never a write aggregate.
 */
export interface Subgraph {
  readonly rootId: NodeId;
  readonly nodes: ReadonlyArray<NodeView>;
  readonly edges: ReadonlyArray<EdgeView>;
  readonly depth: number;
}
