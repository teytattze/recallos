import type { DomainEvent } from "server-kernel";

import type { KnowledgeGraphId, NodeId } from "../ids.value-object.ts";
import type { NodeType } from "../node-type.value-object.ts";

export interface NodeCreated extends DomainEvent {
  readonly eventName: "NodeCreated";
  readonly graphId: string;
  readonly nodeType: NodeType;
}

export function nodeCreated(props: {
  nodeId: NodeId;
  graphId: KnowledgeGraphId;
  type: NodeType;
  occurredAt: Date;
}): NodeCreated {
  return {
    eventName: "NodeCreated",
    aggregateId: props.nodeId.value,
    occurredAt: props.occurredAt,
    graphId: props.graphId.value,
    nodeType: props.type,
  };
}
