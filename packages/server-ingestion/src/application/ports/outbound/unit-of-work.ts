import type { EventLogRepository } from "./event-log.repository.ts";
import type { EventPublisher } from "./event-publisher.ts";

/** The collaborators a use case enlists in one transaction. The event insert and
 *  the outbox write share this scope so "recorded" and "will be published" commit
 *  as a single atomic fact (see outbox decision record). */
export interface IngestionContext {
  events: EventLogRepository;
  publisher: EventPublisher;
}

export interface UnitOfWork {
  /** Run `work` in one transaction: commit when it resolves, roll back if it throws. */
  transaction<T>(work: (ctx: IngestionContext) => Promise<T>): Promise<T>;
}
