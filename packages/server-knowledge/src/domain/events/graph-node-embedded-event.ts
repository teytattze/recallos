import { defineEvent, type DomainEvent } from "@repo/server-kernel";

type NodeEmbeddedPayload = {
  model: string;
  dimensions: number;
};

type NodeEmbeddedEvent = DomainEvent<"NodeEmbedded", NodeEmbeddedPayload>;

const createNodeEmbeddedEvent = defineEvent(
  "NodeEmbedded",
)<NodeEmbeddedPayload>;

export { createNodeEmbeddedEvent };
export type { NodeEmbeddedEvent };
