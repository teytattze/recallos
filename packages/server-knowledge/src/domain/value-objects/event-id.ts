import { Id } from "@repo/server-kernel";

/**
 * Reference to a raw event in the event-log context. The knowledge graph stores
 * these for provenance; it never dereferences them, so the id is modeled locally
 * rather than imported from the ingestion context.
 */
class EventId extends Id {
  static create(): EventId {
    return new EventId(Id.newValue());
  }

  static restore(value: string): EventId {
    return new EventId(value);
  }
}

export { EventId };
