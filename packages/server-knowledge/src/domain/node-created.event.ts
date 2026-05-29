import type { DomainEvent } from "@repo/server-kernel";

import type { NodeType } from "./node-type.value-object.ts";

/** A node aggregate was created — the Worker reacts by embedding it. */
export class NodeCreated implements DomainEvent {
  readonly eventName = "knowledge.NodeCreated";

  constructor(
    readonly aggregateId: string,
    readonly graphId: string,
    readonly type: NodeType,
    readonly occurredAt: Date,
  ) {}
}
