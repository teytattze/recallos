import { parseProps, ValueObject } from "@repo/server-kernel";
import { z } from "zod";

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
      parseProps(eventExternalPropsSchema, input.payload),
    );
  }

  static restore(input: RestoreEventExternalInput): EventExternal {
    return new EventExternal(
      parseProps(eventExternalPropsSchema, input.payload),
    );
  }

  get id(): EventExternalProps["id"] {
    return this._props.id;
  }
  get provider(): EventExternalProps["provider"] {
    return this._props.provider;
  }
}

export { EventExternal };
export type { EventExternalPropsIn };
