import type { EventId } from "../../../domain/value-objects/event-id.ts";

type ProcessedEventLedgerStatus = "done" | "failed";

interface ProcessedEventLedgerPort {
  seen(eventId: EventId, extractorVersion: string): Promise<boolean>;
  record(
    eventId: EventId,
    extractorVersion: string,
    status: ProcessedEventLedgerStatus,
    factHash: string,
    attempts: number,
  ): Promise<void>;
}

export type { ProcessedEventLedgerStatus, ProcessedEventLedgerPort };
