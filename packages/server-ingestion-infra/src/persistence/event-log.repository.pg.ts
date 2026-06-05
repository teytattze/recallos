import type { Prisma } from "@repo/server-database";
import type { Event, EventLogRepositoryPort } from "@repo/server-ingestion";

/** Accepts a `TransactionClient`, not the full `PrismaClient`, so the UnitOfWorkPort
 *  can bind it to the active transaction (a `PrismaClient` is also assignable). */
export class EventLogPostgresqlRepository implements EventLogRepositoryPort {
  constructor(private readonly prisma: Prisma.TransactionClient) {}

  async insert(event: Event): Promise<void> {
    await this.prisma.event.create({
      data: {
        id: event.id.value,
        occurredAt: event.occurredAt,
        createdAt: event.metadata.createdAt,
        tags: event.tags.entries,
        body: event.body.value,
      },
    });
  }
}
