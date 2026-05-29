import type { EventId } from "../../../domain/event-id.value-object.ts";

export type ProcessStatus = "done" | "failed";

/**
 * The record of *effect* — "this event was processed by this extractor version"
 * — keyed on the deterministic `eventId`, so an event is applied exactly once
 * regardless of non-deterministic extraction (§9). Distinct from the cursor,
 * which tracks progress.
 */
export interface ProcessedEventLedger {
  seen(eventId: EventId, extractorVersion: string): Promise<boolean>;
  record(
    eventId: EventId,
    extractorVersion: string,
    status: ProcessStatus,
    factHash: string,
    attempts: number,
  ): Promise<void>;
}
