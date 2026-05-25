import {
  AggregateRoot,
  EntityMetadata,
  Result,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { EventBody } from "./event-body.value-object.ts";
import { EventId } from "./event-id.value-object.ts";
import { InvalidEvent } from "./invalid-event.error.ts";
import { Tags } from "./tags.value-object.ts";

export type CreateEventInput = {
  recordedAt: Date;
  occurredAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
};

export type RestoreEventInput = {
  id: string;
  recordedAt: Date;
  updatedAt: Date;
  occurredAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
};

const eventPropsSchema = z.object({
  occurredAt: z.date(),
  tags: z.custom<Tags>((v) => v instanceof Tags),
  body: z.custom<EventBody>((v) => v instanceof EventBody),
});

type EventProps = z.infer<typeof eventPropsSchema>;

export class Event extends AggregateRoot<EventId, EventProps> {
  private constructor(
    id: EventId,
    metadata: EntityMetadata,
    props: EventProps,
  ) {
    super(id, metadata, props);
  }

  static create(input: CreateEventInput): Result<Event> {
    const createTagsResult = Tags.create(input.tags);
    if (!createTagsResult.ok) return createTagsResult;

    const createBodyResult = EventBody.create(input.body);
    if (!createBodyResult.ok) return createBodyResult;

    const parsePropsResult = parseProps(
      eventPropsSchema,
      {
        occurredAt: input.occurredAt,
        tags: createTagsResult.value,
        body: createBodyResult.value,
      },
      InvalidEvent,
    );
    if (!parsePropsResult.ok) return parsePropsResult;

    const eventProps = parsePropsResult.value;
    if (eventProps.occurredAt.getTime() > input.recordedAt.getTime()) {
      return Result.err(InvalidEvent("occurredAt cannot be in the future"));
    }

    return Result.ok(
      new Event(
        EventId.create(),
        EntityMetadata.create(input.recordedAt),
        eventProps,
      ),
    );
  }

  static restore(input: RestoreEventInput): Event {
    return new Event(
      EventId.restore(input.id),
      EntityMetadata.restore(input.recordedAt, input.updatedAt),
      parsePropsOrThrow(eventPropsSchema, {
        occurredAt: input.occurredAt,
        tags: Tags.restore(input.tags),
        body: EventBody.restore(input.body),
      }),
    );
  }
}
