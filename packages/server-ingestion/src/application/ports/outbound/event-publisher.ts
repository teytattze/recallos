import type { Event } from "../../../domain/event.aggregate.ts";

/** Publishes a recorded event for other contexts (the knowledge-graph Worker) to
 *  consume; the broker stays swappable behind this port. */
export interface EventPublisher {
  publish(event: Event): Promise<void>;
}
