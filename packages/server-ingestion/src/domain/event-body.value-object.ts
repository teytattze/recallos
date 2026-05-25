import { Result, ValueObject } from "@repo/server-kernel";

import { InvalidEvent } from "./invalid-event.error.ts";

type EventBodyProps = {
  value: Readonly<Record<string, unknown>>;
};

export class EventBody extends ValueObject<EventBodyProps> {
  private constructor(props: EventBodyProps) {
    super(props);
  }

  static create(value: Record<string, unknown>): Result<EventBody> {
    if (Object.keys(value).length === 0) {
      return Result.err(InvalidEvent("event body must not be empty"));
    }
    return Result.ok(new EventBody({ value }));
  }

  toJSON(): Record<string, unknown> {
    return { ...this._props.value };
  }
}
