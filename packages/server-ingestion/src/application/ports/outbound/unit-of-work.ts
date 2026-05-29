import type { EventLogRepository } from "./event-log.repository.ts";
import type { EventPublisher } from "./event-publisher.ts";

export interface IngestionContext {
  events: EventLogRepository;
  publisher: EventPublisher;
}

export interface UnitOfWork {
  /** Run `work` in one transaction: commit when it resolves, roll back if it throws. */
  transaction<T>(work: (ctx: IngestionContext) => Promise<T>): Promise<T>;
}
