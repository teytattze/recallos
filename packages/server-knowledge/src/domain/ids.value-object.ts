import { uniqBy } from "es-toolkit";
import { Id } from "server-kernel";

/** Identity of a knowledge graph. */
export class KnowledgeGraphId extends Id {
  static generate(): KnowledgeGraphId {
    return new KnowledgeGraphId(Id.newValue());
  }

  static from(value: string): KnowledgeGraphId {
    return new KnowledgeGraphId(value);
  }
}

/** Identity of a node aggregate. */
export class NodeId extends Id {
  static generate(): NodeId {
    return new NodeId(Id.newValue());
  }

  static from(value: string): NodeId {
    return new NodeId(value);
  }
}

/** Identity of an edge aggregate. */
export class EdgeId extends Id {
  static generate(): EdgeId {
    return new EdgeId(Id.newValue());
  }

  static from(value: string): EdgeId {
    return new EdgeId(value);
  }
}

/**
 * Reference to a raw event in the event-log context. The graph stores these for
 * provenance; it never mints or dereferences them, so there is no `generate`.
 */
export class EventId extends Id {
  static from(value: string): EventId {
    return new EventId(value);
  }
}

/**
 * De-duplicate event references by value. `EventId` is a value object, so a JS
 * `Set` would key by reference and keep two instances of the same id — provenance
 * must be de-duplicated structurally instead.
 */
export function dedupeEventIds(eventIds: readonly EventId[]): EventId[] {
  return uniqBy(eventIds, (eventId) => eventId.value);
}
