import { defineEvent, type DomainEvent } from "@repo/server-kernel";

type NodeEmbeddedPayload = {
  model: string;
  dimensions: number;
};

type NodeEmbeddedEvent = DomainEvent<"NodeEmbedded", NodeEmbeddedPayload>;

const NodeEmbedded = defineEvent("NodeEmbedded")<NodeEmbeddedPayload>;

export { NodeEmbedded };
export type { NodeEmbeddedEvent };
