import type { JsonObject } from "type-fest";

import {
  EntityMetadata,
  type Result,
  Tenant,
  TenantAwareAggregateRoot,
  okResult,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidEventError } from "../errors/invalid-event-error";
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
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    external: EventExternalPropsIn;
    graphId: string;
    raw: JsonObject;
  };
};
type RestoreEventInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    id: string;
    external: EventExternalPropsIn;
    graphId: string;
    raw: JsonObject;
  };
};

class Event extends TenantAwareAggregateRoot<EventId, EventProps> {
  static create(input: CreateEventInput): Result<Event> {
    const graphId = GraphId.restore({
      payload: input.payload.graphId,
    });
    const externalResult = EventExternal.create({
      payload: input.payload.external,
    });

    if (!externalResult.ok) {
      return externalResult;
    }

    const parsePropsResult = parseProps(
      eventPropsSchema,
      {
        external: externalResult.value,
        graphId,
        raw: input.payload.raw,
      },
      createInvalidEventError,
    );

    if (!parsePropsResult.ok) {
      return parsePropsResult;
    }
    const eventProps = parsePropsResult.value;

    return okResult(
      new Event(EventId.create(), input.tenant, input.metadata, eventProps),
    );
  }

  static restore(input: RestoreEventInput): Event {
    return new Event(
      EventId.restore(input.payload.id),
      input.tenant,
      input.metadata,
      parsePropsOrThrow(eventPropsSchema, {
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
