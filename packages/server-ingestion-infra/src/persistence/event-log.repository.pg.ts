import type { Prisma, PrismaClient } from "@repo/server-database";
import type { Event, EventLogRepository } from "@repo/server-ingestion";

export class EventLogPostgresqlRepository implements EventLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insert(event: Event): Promise<void> {
    await this.prisma.event.create({
      data: {
        id: event.id.value,
        occurredAt: event.occurredAt,
        recordedAt: event.metadata.createdAt,
        tags: event.tags.entries as Prisma.InputJsonValue,
        body: event.body.value as Prisma.InputJsonValue,
      },
    });
  }
}
