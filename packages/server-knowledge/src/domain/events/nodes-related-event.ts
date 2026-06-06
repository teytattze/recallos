import { defineEvent, type DomainEvent } from "@repo/server-kernel";

import type { RelationshipType } from "../value-objects/relationship-type.ts";

type NodesRelatedPayload = {
  fromId: string;
  toId: string;
  relationship: RelationshipType;
};

type NodesRelatedEvent = DomainEvent<"NodesRelated", NodesRelatedPayload>;

const createNodesRelatedEvent = defineEvent(
  "NodesRelated",
)<NodesRelatedPayload>;

export { createNodesRelatedEvent };
export type { NodesRelatedEvent };
