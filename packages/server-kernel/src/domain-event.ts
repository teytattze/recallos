/**
 * Something that happened in the domain. Aggregates record events as they
 * mutate; the application layer drains them after persistence and hands them to
 * a publisher port so other contexts react.
 *
 * `occurredAt` is minted from a {@link Clock} at the use-case boundary, never
 * read from the wall clock inside the domain, which must stay pure.
 */
export interface DomainEvent {
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
}
