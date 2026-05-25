import type { DomainEvent } from "server-kernel";

import type { Confidence } from "../confidence.value-object.ts";
import type { EdgeId, EventId } from "../ids.value-object.ts";

export interface EdgeReinforced extends DomainEvent {
  readonly eventName: "EdgeReinforced";
  readonly confidence: number;
  readonly addedEventIds: readonly string[];
}

export function edgeReinforced(props: {
  edgeId: EdgeId;
  confidence: Confidence;
  addedEventIds: readonly EventId[];
  occurredAt: Date;
}): EdgeReinforced {
  return {
    eventName: "EdgeReinforced",
    aggregateId: props.edgeId.value,
    occurredAt: props.occurredAt,
    confidence: props.confidence.value,
    addedEventIds: props.addedEventIds.map((eventId) => eventId.value),
  };
}
