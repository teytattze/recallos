import type { DomainEvent } from "./domain-event.ts";
import type { Id } from "./id.ts";

import { Entity } from "./entity.ts";
import { EntityMetadata } from "./metadata.ts";

/**
 * The entry point to an aggregate — the consistency boundary the application
 * loads, mutates, and saves as one unit. On top of {@link Entity} it adds the
 * concerns shared by *every* persisted root: its {@link EntityMetadata} audit
 * stamps and a buffer of the {@link DomainEvent}s raised while handling a
 * command.
 *
 * Tenancy is deliberately **not** here — not every aggregate belongs to a user
 * or organization (a pricing catalog or feature-flag set is global). Roots that
 * are owned by a tenant extend {@link TenantAggregateRoot} instead, which adds
 * the access boundary; global roots extend this class directly.
 *
 * `metadata` is swapped for a fresh value on each mutation via the protected
 * {@link touch}, whose `now` — like every instant in the domain — is minted from
 * a {@link Clock} at the use-case boundary and passed in.
 *
 * The application layer calls {@link pullDomainEvents} *after* the aggregate is
 * persisted to forward the events to a publisher; pulling clears the buffer so
 * each event is dispatched exactly once. Outside callers only read events — they
 * are recorded by the aggregate's own methods via the protected
 * {@link recordEvent}.
 */
export abstract class AggregateRoot<
  TId extends Id,
  T extends Record<string, unknown> = Record<string, never>,
> extends Entity<TId, T> {
  private readonly _domainEvents: DomainEvent[] = [];

  protected _metadata: EntityMetadata;

  protected constructor(id: TId, metadata: EntityMetadata, props: T) {
    super(id, props);
    this._metadata = metadata;
  }

  get metadata(): EntityMetadata {
    return this._metadata;
  }

  /** Advance `updatedAt` after a state change; call from mutating methods. */
  protected touch(now: Date): void {
    this._metadata = this._metadata.touch(now);
  }

  /** Buffer an event raised while mutating this aggregate. */
  protected recordEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /** Return the buffered events and clear the buffer (drain-once). */
  pullDomainEvents(): readonly DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }
}
