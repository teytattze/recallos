import {
  EntityMetadata,
  type Result,
  Tenant,
  TenantAwareAggregateRoot,
  errResult,
  okResult,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidEventError } from "../errors/invalid-event-error";
import { EventBody } from "../value-objects/event-body";
import { EventId } from "../value-objects/event-id";
import { Tags } from "../value-objects/tags";

const eventPropsSchema = z.object({
  occurredAt: z.date(),
  tags: z.custom<Tags>((v) => v instanceof Tags),
  body: z.custom<EventBody>((v) => v instanceof EventBody),
});
type EventProps = z.infer<typeof eventPropsSchema>;

type CreateEventInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    occurredAt: Date;
    tags: Record<string, string>;
    body: Record<string, unknown>;
  };
};

type RestoreEventInput = {
  tenant: Tenant;
  metadata: EntityMetadata;
  payload: {
    id: string;
    occurredAt: Date;
    tags: Record<string, string>;
    body: Record<string, unknown>;
  };
};

class Event extends TenantAwareAggregateRoot<EventId, EventProps> {
  private constructor(
    id: EventId,
    tenant: Tenant,
    metadata: EntityMetadata,
    props: EventProps,
  ) {
    super(id, tenant, metadata, props);
  }

  static create(input: CreateEventInput): Result<Event> {
    const createTagsResult = Tags.create({ payload: input.payload.tags });

    if (!createTagsResult.ok) {
      return createTagsResult;
    }
    const createBodyResult = EventBody.create({ payload: input.payload.body });

    if (!createBodyResult.ok) {
      return createBodyResult;
    }
    const parsePropsResult = parseProps(
      eventPropsSchema,
      {
        occurredAt: input.payload.occurredAt,
        tags: createTagsResult.value,
        body: createBodyResult.value,
      },
      createInvalidEventError,
    );

    if (!parsePropsResult.ok) {
      return parsePropsResult;
    }
    const eventProps = parsePropsResult.value;

    if (eventProps.occurredAt.getTime() > input.metadata.createdAt.getTime()) {
      return errResult(
        createInvalidEventError("occurredAt cannot be in the future"),
      );
    }
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
        occurredAt: input.payload.occurredAt,
        tags: Tags.restore({ payload: input.payload.tags }),
        body: EventBody.restore({ payload: input.payload.body }),
      }),
    );
  }

  get occurredAt(): Date {
    return this._props.occurredAt;
  }

  get tags(): Tags {
    return this._props.tags;
  }

  get body(): EventBody {
    return this._props.body;
  }
}

export { Event };
