import type { JsonObject } from "type-fest";

import {
  EntityMetadata,
  Tenant,
  TenantAwareAggregateRoot,
  parseProps,
} from "@repo/server-kernel";
import { z } from "zod";

import {
  EventExternal,
  type EventExternalPropsIn,
} from "../value-objects/event-external";
import { EventId } from "../value-objects/event-id";
import { GraphId } from "../value-objects/graph-id";

const eventPropsSchema = z.object({
  external: z.custom<EventExternal>((v) => v instanceof EventExternal),
  graphId: z.custom<GraphId>((v) => v instanceof GraphId),
  raw: z
    .custom<JsonObject>((data) => z.json().safeParse(data).success)
    .brand<"EventRaw">(),
});

type EventProps = z.output<typeof eventPropsSchema>;

type CreateEventInput = {
  tenant: string;
  metadata: { now: Date };
  payload: {
    external: EventExternalPropsIn;
    graphId: string;
    raw: JsonObject;
  };
};
type RestoreEventInput = {
  tenant: string;
  metadata: { createdAt: Date; updatedAt: Date };
  payload: {
    id: string;
    external: EventExternalPropsIn;
    graphId: string;
    raw: JsonObject;
  };
};

class Event extends TenantAwareAggregateRoot<EventId, EventProps> {
  static create(input: CreateEventInput): Event {
    return new Event(
      EventId.create(),
      Tenant.fromString(input.tenant),
      EntityMetadata.create({ payload: input.metadata }),
      parseProps(eventPropsSchema, {
        external: EventExternal.create({ payload: input.payload.external }),
        graphId: GraphId.restore({ payload: input.payload.graphId }),
        raw: input.payload.raw,
      }),
    );
  }

  static restore(input: RestoreEventInput): Event {
    return new Event(
      EventId.restore({ payload: input.payload.id }),
      Tenant.fromString(input.tenant),
      EntityMetadata.restore({ payload: input.metadata }),
      parseProps(eventPropsSchema, {
        external: EventExternal.restore({ payload: input.payload.external }),
        graphId: GraphId.restore({ payload: input.payload.graphId }),
        raw: input.payload.raw,
      }),
    );
  }

  estimatedSizeInBytes(): number {
    return new TextEncoder("utf-8").encode(JSON.stringify(this)).length;
  }

  get external(): EventExternal {
    return this._props.external;
  }
  get graphId(): GraphId {
    return this._props.graphId;
  }
  get raw(): JsonObject {
    return this._props.raw;
  }
}

export { Event };
