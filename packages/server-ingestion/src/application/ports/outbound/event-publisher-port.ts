import type { Event } from "../../../domain/aggregates/event.ts";

interface EventPublisherPort {
  publish(event: Event): Promise<void>;
}

export type { EventPublisherPort };
