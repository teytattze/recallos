import {
  Result,
  ValueObject,
  parseProps,
  parsePropsOrThrow,
} from "@repo/server-kernel";
import { z } from "zod";

import { InvalidEvent } from "./invalid-event.error.ts";

const eventBodyPropsSchema = z.object({
  value: z
    .record(z.string(), z.unknown())
    .refine((v) => Object.keys(v).length > 0, "event body must not be empty"),
});

type EventBodyProps = z.infer<typeof eventBodyPropsSchema>;

export class EventBody extends ValueObject<EventBodyProps> {
  private constructor(props: EventBodyProps) {
    super(props);
  }

  static create(value: Record<string, unknown>): Result<EventBody> {
    return Result.map(
      parseProps(eventBodyPropsSchema, { value }, InvalidEvent),
      (props) => new EventBody(props),
    );
  }

  static restore(value: Record<string, unknown>): EventBody {
    return new EventBody(parsePropsOrThrow(eventBodyPropsSchema, { value }));
  }
}
