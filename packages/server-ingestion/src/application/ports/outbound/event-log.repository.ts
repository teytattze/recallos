import type { Event } from "../../../domain/event.aggregate.ts";

/** `append`, not `save`: events are immutable facts — the log only grows,
 *  never updates or deletes. */
export interface EventLogRepository {
  append(event: Event): Promise<void>;
}
