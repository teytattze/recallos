import type { PrismaClient } from "@repo/server-database";
import type {
  UnitOfWorkPort,
  UnitOfWorkPortContext,
} from "@repo/server-ingestion";

import { EventLogPostgresqlRepository } from "./event-log.repository.pg.ts";
import { OutboxEventPublisher } from "./outbox-event-publisher.pg.ts";

export class PrismaUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) =>
      work({
        events: new EventLogPostgresqlRepository(tx),
        publisher: new OutboxEventPublisher(tx),
      }),
    );
  }
}
