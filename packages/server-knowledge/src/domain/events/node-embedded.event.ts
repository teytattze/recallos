import type { DomainEvent } from "server-kernel";

import type { NodeId } from "../ids.value-object.ts";

export interface NodeEmbedded extends DomainEvent {
  readonly eventName: "NodeEmbedded";
  readonly model: string;
  readonly dimensions: number;
}

export function nodeEmbedded(props: {
  nodeId: NodeId;
  model: string;
  dimensions: number;
  occurredAt: Date;
}): NodeEmbedded {
  return {
    eventName: "NodeEmbedded",
    aggregateId: props.nodeId.value,
    occurredAt: props.occurredAt,
    model: props.model,
    dimensions: props.dimensions,
  };
}
