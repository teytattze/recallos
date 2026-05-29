import type { EventId } from "../../../domain/event-id.value-object.ts";

/**
 * A knowledge-graph-owned read DTO for one item in the ingest log — the
 * anti-corruption boundary (§4). Assembled from the thin SQS notification
 * (`id`, `occurredAt`, `tags`) plus the `body` re-read here; it **never**
 * exposes the ingestion `Event` aggregate.
 */
export type EventEntry = {
  id: EventId;
  occurredAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
};

/**
 * Re-reads opaque event bodies from the source of truth (the ingest `events`
 * table). Published messages are thin — they carry ids/timestamps/tags but not
 * the body (it can be large and goes stale), so the worker re-reads bodies by
 * id when it processes a message (outbox→SQS decision record).
 */
export interface EventSourceReader {
  /** Bodies keyed by `EventId.value`; a missing id is simply absent from the map. */
  readBodies(ids: EventId[]): Promise<Map<string, Record<string, unknown>>>;
}
