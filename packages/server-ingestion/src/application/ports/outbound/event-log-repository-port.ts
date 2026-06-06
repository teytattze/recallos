import type { Event } from "../../../domain/aggregates/event.ts";

interface EventLogRepositoryPort {
  insert(event: Event): Promise<void>;
}

export type { EventLogRepositoryPort };
