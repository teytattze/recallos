import type { PrismaClient } from "@repo/server-database";
import type { IngestionContext, UnitOfWork } from "@repo/server-ingestion";

import { EventLogPostgresqlRepository } from "./event-log.repository.pg.ts";
import { OutboxEventPublisher } from "./outbox-event-publisher.pg.ts";

/** Runs the work inside one Prisma interactive transaction and hands it
 *  repositories bound to that transaction, so the event insert and the outbox
 *  write commit (or roll back) together. */
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(work: (ctx: IngestionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) =>
      work({
        events: new EventLogPostgresqlRepository(tx),
        publisher: new OutboxEventPublisher(tx),
      }),
    );
  }
}
