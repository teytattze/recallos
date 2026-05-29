import type { DomainEvent } from "@repo/server-kernel";

/** New source events were attached to an existing node (reinforcement/merge). */
export class NodeProvenanceExtended implements DomainEvent {
  readonly eventName = "knowledge.NodeProvenanceExtended";

  constructor(
    readonly aggregateId: string,
    readonly eventIds: string[],
    readonly occurredAt: Date,
  ) {}
}
