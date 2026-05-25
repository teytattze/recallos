import { AggregateRoot, EntityMetadata, Result } from "@repo/server-kernel";

import { EventBody } from "./event-body.value-object.ts";
import { EventId } from "./event-id.value-object.ts";
import { InvalidEvent } from "./invalid-event.error.ts";
import { Tags } from "./tags.value-object.ts";

export type RecordEventProps = {
  occurredAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
};

type EventProps = {
  occurredAt: Date;
  tags: Tags;
  body: EventBody;
};

export class Event extends AggregateRoot<EventId, EventProps> {
  private constructor(
    id: EventId,
    metadata: EntityMetadata,
    props: EventProps,
  ) {
    super(id, metadata, props);
  }

  get occurredAt(): Date {
    return this._props.occurredAt;
  }

  // When RecallOS captured the event — the creation instant from the Clock.
  get recordedAt(): Date {
    return this._metadata.createdAt;
  }

  get tags(): Tags {
    return this._props.tags;
  }

  get body(): EventBody {
    return this._props.body;
  }

  // `recordedAt` is supplied by the caller (the Clock port) — the domain never
  // reads the wall clock.
  static record(props: RecordEventProps, recordedAt: Date): Result<Event> {
    if (Number.isNaN(props.occurredAt.getTime())) {
      return Result.err(InvalidEvent("occurredAt is not a valid date"));
    }
    if (props.occurredAt.getTime() > recordedAt.getTime()) {
      return Result.err(InvalidEvent("occurredAt cannot be in the future"));
    }

    const tags = Tags.create(props.tags);
    if (!tags.ok) return tags;

    const body = EventBody.create(props.body);
    if (!body.ok) return body;

    return Result.ok(
      new Event(EventId.generate(), EntityMetadata.create(recordedAt), {
        occurredAt: props.occurredAt,
        tags: tags.value,
        body: body.value,
      }),
    );
  }
}
