import type { Event } from "../../../domain/event.aggregate.ts";

/** `insert`, not `save`/`update`: events are immutable facts — the log only
 *  grows, never updates or deletes. */
export interface EventLogRepository {
  insert(event: Event): Promise<void>;
}
