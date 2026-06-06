import { defineEvent, type DomainEvent } from "@repo/server-kernel";

import type { NodeType } from "../value-objects/node-type.ts";

type NodeCreatedPayload = {
  graphId: string;
  type: NodeType;
};

type NodeCreatedEvent = DomainEvent<"NodeCreated", NodeCreatedPayload>;

const createNodeCreatedEvent = defineEvent("NodeCreated")<NodeCreatedPayload>;

export { createNodeCreatedEvent };
export type { NodeCreatedEvent };
