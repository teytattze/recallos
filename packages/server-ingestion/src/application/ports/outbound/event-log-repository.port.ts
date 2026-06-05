import type { Event } from "../../../domain/event.aggregate.ts";

export interface EventLogRepositoryPort {
  insert(event: Event): Promise<void>;
}
