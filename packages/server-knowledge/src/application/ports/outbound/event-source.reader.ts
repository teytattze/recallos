import type { EventId } from "../../../domain/event-id.value-object.ts";
import type { Checkpoint } from "./checkpoint.store.ts";

/**
 * A knowledge-graph-owned read DTO for one item in the ingest log — the
 * anti-corruption boundary (§4). The adapter maps `events` rows to this and
 * **never** exposes the ingestion `Event` aggregate. `recordedAt` drives the
 * cursor; `occurredAt` becomes an edge's `observedAt`.
 */
export type EventEntry = {
  id: EventId;
  recordedAt: Date;
  occurredAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
};

export interface EventSourceReader {
  /** Events with `recordedAt > cursor`, ordered by `(recordedAt, id)`. */
  readSince(cursor: Checkpoint, limit: number): Promise<EventEntry[]>;
}
