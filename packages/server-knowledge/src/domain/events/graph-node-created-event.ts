import { defineEvent, type DomainEvent } from "@repo/server-kernel";

type NodeCreatedPayload = {
  graphId: string;
};

type NodeCreatedEvent = DomainEvent<"NodeCreated", NodeCreatedPayload>;

const createNodeCreatedEvent = defineEvent("NodeCreated")<NodeCreatedPayload>;

export { createNodeCreatedEvent };
export type { NodeCreatedEvent };
