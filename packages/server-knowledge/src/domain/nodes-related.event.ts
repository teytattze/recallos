import type { DomainEvent } from "@repo/server-kernel";

import type { RelationshipType } from "./relationship-type.value-object.ts";

/** A new edge was created between two nodes. */
export class NodesRelated implements DomainEvent {
  readonly eventName = "knowledge.NodesRelated";

  constructor(
    readonly aggregateId: string,
    readonly fromId: string,
    readonly toId: string,
    readonly relationship: RelationshipType,
    readonly occurredAt: Date,
  ) {}
}
