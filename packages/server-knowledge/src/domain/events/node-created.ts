import { defineEvent, type DomainEvent } from "@repo/server-kernel";

import type { NodeType } from "../value-objects/node-type.ts";

type NodeCreatedPayload = {
  graphId: string;
  type: NodeType;
};

type NodeCreatedEvent = DomainEvent<"NodeCreated", NodeCreatedPayload>;

const NodeCreated = defineEvent("NodeCreated")<NodeCreatedPayload>;

export { NodeCreated };
export type { NodeCreatedEvent };
