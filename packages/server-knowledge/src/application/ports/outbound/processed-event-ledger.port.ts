import type { EventId } from "../../../domain/event-id.value-object.ts";

export type ProcessedEventLedgerStatus = "done" | "failed";

export interface ProcessedEventLedgerPort {
  seen(eventId: EventId, extractorVersion: string): Promise<boolean>;
  record(
    eventId: EventId,
    extractorVersion: string,
    status: ProcessedEventLedgerStatus,
    factHash: string,
    attempts: number,
  ): Promise<void>;
}
