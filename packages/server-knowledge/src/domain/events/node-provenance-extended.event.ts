import type { DomainEvent } from "server-kernel";

import type { EventId, NodeId } from "../ids.value-object.ts";

export interface NodeProvenanceExtended extends DomainEvent {
  readonly eventName: "NodeProvenanceExtended";
  readonly addedEventIds: readonly string[];
}

export function nodeProvenanceExtended(props: {
  nodeId: NodeId;
  addedEventIds: readonly EventId[];
  occurredAt: Date;
}): NodeProvenanceExtended {
  return {
    eventName: "NodeProvenanceExtended",
    aggregateId: props.nodeId.value,
    occurredAt: props.occurredAt,
    addedEventIds: props.addedEventIds.map((eventId) => eventId.value),
  };
}
