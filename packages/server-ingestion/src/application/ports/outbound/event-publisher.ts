import type { Event } from "../../../domain/event.aggregate.ts";

/** Publishes a recorded event for other contexts (the knowledge-graph Worker) to
 *  consume. Implemented by the transactional outbox so capture and notification
 *  commit atomically (see outbox decision record); the broker stays swappable
 *  behind this port. */
export interface EventPublisher {
  publish(event: Event): Promise<void>;
}
