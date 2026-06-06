import {
  ValueObject,
  mapResult,
  parseProps,
  parsePropsOrThrow,
  type Result,
} from "@repo/server-kernel";
import { z } from "zod";

import { InvalidEvent } from "./invalid-event.error.ts";

const eventBodyPropsSchema = z.object({
  value: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .refine((v) => Object.keys(v).length > 0, "event body must not be empty"),
});

type EventBodyProps = z.infer<typeof eventBodyPropsSchema>;

export class EventBody extends ValueObject<EventBodyProps> {
  private constructor(props: EventBodyProps) {
    super(props);
  }

  get value(): EventBodyProps["value"] {
    return this._props.value;
  }

  static create(value: Record<string, unknown>): Result<EventBody> {
    return mapResult(
      parseProps(eventBodyPropsSchema, { value }, InvalidEvent),
      (props) => new EventBody(props),
    );
  }

  static restore(value: Record<string, unknown>): EventBody {
    return new EventBody(parsePropsOrThrow(eventBodyPropsSchema, { value }));
  }
}
