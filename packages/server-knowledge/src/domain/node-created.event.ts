import type { DomainEvent } from "@repo/server-kernel";

import type { NodeType } from "./node-type.value-object.ts";

export class NodeCreated implements DomainEvent {
  readonly eventName = "NodeCreated";

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly graphId: string,
    readonly type: NodeType,
  ) {}
}
