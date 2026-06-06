import { defineEvent, type DomainEvent } from "@repo/server-kernel";

import type { RelationshipType } from "./relationship-type.value-object.ts";

type NodesRelatedPayload = {
  fromId: string;
  toId: string;
  relationship: RelationshipType;
};

type NodesRelatedEvent = DomainEvent<"NodesRelated", NodesRelatedPayload>;

const NodesRelated = defineEvent("NodesRelated")<NodesRelatedPayload>;

export { NodesRelated };
export type { NodesRelatedEvent };
