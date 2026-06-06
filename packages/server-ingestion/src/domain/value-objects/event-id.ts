import { Id } from "@repo/server-kernel";

class EventId extends Id {
  static create(): EventId {
    return new EventId(Id.newValue());
  }

  static restore(value: string): EventId {
    return new EventId(value);
  }
}

export { EventId };
