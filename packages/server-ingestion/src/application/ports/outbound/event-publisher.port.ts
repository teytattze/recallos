import type { Event } from "../../../domain/event.aggregate.ts";

export interface EventPublisherPort {
  publish(event: Event): Promise<void>;
}
