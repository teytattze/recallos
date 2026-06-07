import type { EventId } from "../../../domain/value-objects/event-id.ts";

interface ProcessedEventRepositoryPort {
  seen(input: { payload: { eventId: EventId } }): Promise<boolean>;
  insert(input: { payload: { eventId: EventId } }): Promise<void>;
}

export type { ProcessedEventRepositoryPort };
