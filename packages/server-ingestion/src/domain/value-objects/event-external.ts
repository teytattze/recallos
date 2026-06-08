import { parseProps, parsePropsOrThrow, ValueObject } from "@repo/server-kernel";
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
  static create(input: CreateEventExternalInput): EventExternal {
    return new EventExternal(
      parseProps(
        eventExternalPropsSchema,
        input.payload,
        createInvalidEventError,
      ),
    );
  }

  static restore(input: RestoreEventExternalInput): EventExternal {
    return new EventExternal(
      parsePropsOrThrow(eventExternalPropsSchema, input.payload),
    );
  }
}

export { EventExternal };
export type { EventExternalPropsIn };
