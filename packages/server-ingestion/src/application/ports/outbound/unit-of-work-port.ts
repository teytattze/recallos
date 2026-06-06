import type { EventLogRepositoryPort } from "./event-log-repository-port.ts";
import type { EventPublisherPort } from "./event-publisher-port.ts";

interface UnitOfWorkPortContext {
  events: EventLogRepositoryPort;
  publisher: EventPublisherPort;
}

interface UnitOfWorkPort {
  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T>;
}

export type { UnitOfWorkPortContext, UnitOfWorkPort };
