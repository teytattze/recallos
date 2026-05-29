import type { DomainEvent } from "@repo/server-kernel";

/** Publishes domain events drained from aggregates *after* the commit, so other
 *  contexts (and the Worker itself) can react — e.g. `NodeCreated` → embed. */
export interface EventPublisher {
  publish(events: readonly DomainEvent[]): Promise<void>;
}
