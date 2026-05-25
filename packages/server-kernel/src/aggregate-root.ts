import type { DomainEvent } from "./domain-event.ts";
import type { Id } from "./id.ts";

import { Entity } from "./entity.ts";
import { EntityMetadata } from "./metadata.ts";

/**
 * The entry point to an aggregate — the consistency boundary loaded, mutated,
 * and saved as one unit. Over {@link Entity} it adds the {@link EntityMetadata}
 * audit stamps and a buffer of {@link DomainEvent}s raised while handling a
 * command.
 *
 * Tenancy is deliberately not here: not every aggregate belongs to a tenant (a
 * pricing catalog is global). Tenant-scoped roots extend
 * {@link TenantAggregateRoot} instead.
 *
 * The application layer calls {@link pullDomainEvents} after persistence;
 * pulling clears the buffer so each event is dispatched exactly once.
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
