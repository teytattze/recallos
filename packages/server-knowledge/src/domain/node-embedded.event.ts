import type { DomainEvent } from "@repo/server-kernel";

/** The Worker assigned or refreshed a node's embedding. */
export class NodeEmbedded implements DomainEvent {
  readonly eventName = "knowledge.NodeEmbedded";

  constructor(
    readonly aggregateId: string,
    readonly model: string,
    readonly dimensions: number,
    readonly occurredAt: Date,
  ) {}
}
