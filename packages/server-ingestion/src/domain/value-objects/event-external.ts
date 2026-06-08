import {
  mapResult,
  parseProps,
  parsePropsOrThrow,
  ValueObject,
  type Result,
} from "@repo/server-kernel";
import { z } from "zod";

import { createInvalidEventError } from "../errors/invalid-event-error";

const eventExternalPropsSchema = z.object({
  id: z.string().brand<"EventExternalId">(),
  provider: z.enum(["jira"]).brand<"EventExternalProvider">(),
});

type EventExternalPropsIn = z.input<typeof eventExternalPropsSchema>;
type EventExternalProps = z.output<typeof eventExternalPropsSchema>;

type CreateEventExternalInput = {
  payload: EventExternalPropsIn;
};
type RestoreEventExternalInput = {
  payload: EventExternalPropsIn;
};

class EventExternal extends ValueObject<EventExternalProps> {
  private constructor(props: EventExternalProps) {
    super(props);
  }

  static create(input: CreateEventExternalInput): Result<EventExternal> {
    return mapResult(
      parseProps(
        eventExternalPropsSchema,
        { entries: input.payload },
        createInvalidEventError,
      ),
      (props) => new EventExternal(props),
    );
  }

  static restore(input: RestoreEventExternalInput): EventExternal {
    return new EventExternal(
      parsePropsOrThrow(eventExternalPropsSchema, { entries: input.payload }),
    );
  }
}

export { EventExternal };
export type { EventExternalPropsIn };
