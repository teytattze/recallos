import type { DomainEvent } from "server-kernel";

import type { EdgeId, NodeId } from "../ids.value-object.ts";
import type { RelationshipType } from "../relationship-type.value-object.ts";

export interface NodesRelated extends DomainEvent {
  readonly eventName: "NodesRelated";
  readonly fromId: string;
  readonly toId: string;
  readonly relationship: RelationshipType;
}

export function nodesRelated(props: {
  edgeId: EdgeId;
  fromId: NodeId;
  toId: NodeId;
  relationship: RelationshipType;
  occurredAt: Date;
}): NodesRelated {
  return {
    eventName: "NodesRelated",
    aggregateId: props.edgeId.value,
    occurredAt: props.occurredAt,
    fromId: props.fromId.value,
    toId: props.toId.value,
    relationship: props.relationship,
  };
}
