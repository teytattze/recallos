import type { DomainEvent } from "@repo/server-kernel";

/** An existing edge was re-asserted by a later event. */
export class EdgeReinforced implements DomainEvent {
  readonly eventName = "knowledge.EdgeReinforced";

  constructor(
    readonly aggregateId: string,
    readonly confidence: number,
    readonly sourceEventIds: string[],
    readonly occurredAt: Date,
  ) {}
}
