import type { PrismaClient } from "@repo/server-database";
import type {
  UnitOfWorkPort,
  UnitOfWorkPortContext,
} from "@repo/server-ingestion";

import { EventLogPrismaRepository } from "./event-log-prisma-repository.ts";
import { OutboxEventPrismaPublisher } from "./outbox-event-prisma-publisher.ts";

class PrismaUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) =>
      work({
        events: new EventLogPrismaRepository(tx),
        publisher: new OutboxEventPrismaPublisher(tx),
      }),
    );
  }
}

export { PrismaUnitOfWork };
