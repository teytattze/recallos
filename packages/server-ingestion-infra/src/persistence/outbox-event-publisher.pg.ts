import type { Prisma } from "@repo/server-database";
import type { Event, EventPublisherPort } from "@repo/server-ingestion";

/** Writes the relay metadata row. The canonical body stays in `events`; the relay
 *  joins it in when publishing to SQS. */
export class OutboxEventPublisher implements EventPublisherPort {
  constructor(private readonly prisma: Prisma.TransactionClient) {}

  async publish(event: Event): Promise<void> {
    await this.prisma.eventOutbox.create({
      data: {
        eventId: event.id.value,
        occurredAt: event.occurredAt,
        createdAt: event.metadata.createdAt,
        tags: event.tags.entries,
      },
    });
  }
}
