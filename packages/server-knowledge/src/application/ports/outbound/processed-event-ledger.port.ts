import type { EventId } from "../../../domain/event-id.value-object.ts";

export type ProcessStatus = "done" | "failed";

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
