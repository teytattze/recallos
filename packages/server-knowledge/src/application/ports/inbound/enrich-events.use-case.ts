import type { Result } from "@repo/server-kernel";

import type { EventId } from "../../../domain/event-id.value-object.ts";

/**
 * One recorded-event notification delivered off the queue (outbox→SQS). Thin by
 * design — `id`, `occurredAt`, and routing `tags`; the body is re-read from the
 * source of truth during processing (see `EventSourceReader`).
 */
export type EventNotification = {
  id: EventId;
  occurredAt: Date;
  tags: Record<string, string>;
};

export type EnrichEventsInput = {
  events: EventNotification[];
};

export type EnrichmentReport = {
  received: number;
  processed: number;
  skipped: number;
  failed: number;
  nodesUpserted: number;
  edgesWritten: number;
};

/**
 * The hot path: for a batch of event notifications, re-read bodies → extract →
 * resolve → upsert nodes → relate edges → publish domain events, as one run.
 * Driven by the queue consumer; at-least-once delivery is made safe by the
 * idempotent processed-events ledger (§9).
 */
export interface EnrichEvents {
  execute(input: EnrichEventsInput): Promise<Result<EnrichmentReport>>;
}
