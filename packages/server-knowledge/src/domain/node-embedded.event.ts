import type { DomainEvent } from "@repo/server-kernel";

export class NodeEmbedded implements DomainEvent {
  readonly eventName = "NodeEmbedded";

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly model: string,
    readonly dimensions: number,
  ) {}
}
