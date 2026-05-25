/**
 * Something that happened in the domain, stated in the past tense
 * (`"MemoryItemCaptured"`). Aggregates record events as they change state; the
 * application layer drains them after persistence and hands them to a publisher
 * (an outbound port) so other contexts can react.
 *
 * `occurredAt` is supplied by the caller — minted from a {@link Clock} at the
 * use-case boundary — never read from the wall clock inside the domain, which
 * must stay pure and deterministic. `aggregateId` is the stringified
 * {@link Id} of the aggregate that raised the event.
 *
 * Concrete events extend this with their own readonly payload fields:
 *
 * ```ts
 * interface MemoryItemCaptured extends DomainEvent {
 *   readonly eventName: "MemoryItemCaptured";
 *   readonly source: string;
 * }
 * ```
 */
export interface DomainEvent {
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
}
