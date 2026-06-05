import type { EventLogRepositoryPort } from "./event-log-repository.port.ts";
import type { EventPublisherPort } from "./event-publisher.port.ts";

export interface UnitOfWorkContext {
  events: EventLogRepositoryPort;
  publisher: EventPublisherPort;
}

export interface UnitOfWorkPort {
  transaction<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T>;
}
