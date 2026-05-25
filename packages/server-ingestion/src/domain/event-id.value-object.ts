import { Id } from "@repo/server-kernel";

export class EventId extends Id {
  static generate(): EventId {
    return new EventId(Id.newValue());
  }

  static from(value: string): EventId {
    return new EventId(value);
  }
}
