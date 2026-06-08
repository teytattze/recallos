import type { EventRepositoryPort } from "./event-repository-port.ts";

interface UnitOfWorkPortContext {
  eventRepository: EventRepositoryPort;
}

interface UnitOfWorkPort {
  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T>;
}

export type { UnitOfWorkPortContext, UnitOfWorkPort };
