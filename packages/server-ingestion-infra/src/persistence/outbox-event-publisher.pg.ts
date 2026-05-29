import type { Prisma } from "@repo/server-database";
import type { Event, EventPublisher } from "@repo/server-ingestion";

/** Writes one thin `event_outbox` row — eventId, timestamps, routing tags, never
 *  the body (the Worker re-reads that from `events`). Takes a `TransactionClient`
 *  so the row commits in the same transaction as the event insert. */
export class OutboxEventPublisher implements EventPublisher {
  constructor(private readonly prisma: Prisma.TransactionClient) {}

  async publish(event: Event): Promise<void> {
    await this.prisma.eventOutbox.create({
      data: {
        eventId: event.id.value,
        occurredAt: event.occurredAt,
        recordedAt: event.metadata.createdAt,
        tags: event.tags.entries,
      },
    });
  }
}
