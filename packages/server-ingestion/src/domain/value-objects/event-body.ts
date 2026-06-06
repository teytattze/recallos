import {
  ValueObject,
  mapResult,
  parseProps,
  parsePropsOrThrow,
  type Result,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidEventError } from "../errors/invalid-event-error";

const eventBodyPropsSchema = z.object({
  value: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .refine((v) => Object.keys(v).length > 0, "event body must not be empty"),
});
type EventBodyProps = z.infer<typeof eventBodyPropsSchema>;

type CreateEventBody = {
  payload: Record<string, unknown>;
};
type RestoreEventBody = {
  payload: Record<string, unknown>;
};

class EventBody extends ValueObject<EventBodyProps> {
  private constructor(props: EventBodyProps) {
    super(props);
  }

  get value(): EventBodyProps["value"] {
    return this._props.value;
  }

  static create(input: CreateEventBody): Result<EventBody> {
    return mapResult(
      parseProps(
        eventBodyPropsSchema,
        { value: input.payload },
        createInvalidEventError,
      ),
      (props) => new EventBody(props),
    );
  }

  static restore(input: RestoreEventBody): EventBody {
    return new EventBody(
      parsePropsOrThrow(eventBodyPropsSchema, { value: input.payload }),
    );
  }
}

export { EventBody };
