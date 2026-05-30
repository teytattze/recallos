import type { DomainEvent } from "@repo/server-kernel";

import type { RelationshipType } from "./relationship-type.value-object.ts";

export class NodesRelated implements DomainEvent {
  readonly eventName = "NodesRelated";

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly fromId: string,
    readonly toId: string,
    readonly relationship: RelationshipType,
  ) {}
}
