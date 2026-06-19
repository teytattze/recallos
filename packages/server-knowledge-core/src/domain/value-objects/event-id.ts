import { Id } from "@repo/server-kernel";

type RestoreEventIdInput = {
  payload: string;
};

class EventId extends Id {
  static create(): EventId {
    return new EventId(Id.newValue());
  }
  static restore(input: RestoreEventIdInput): EventId {
    return new EventId(input.payload);
  }
}

export { EventId };
