import type { Event } from "../../../domain/aggregates/event.ts";

interface EventRepositoryPort {
  insert(event: Event): Promise<void>;
}

export type { EventRepositoryPort };
