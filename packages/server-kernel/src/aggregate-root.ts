import type { DomainEvent } from "./domain-event.ts";
import type { Id } from "./id.ts";

import { Entity } from "./entity.ts";
import { EntityMetadata } from "./metadata.ts";

abstract class AggregateRoot<
  TId extends Id,
  TProps extends Record<string, unknown> = Record<never, never>,
> extends Entity<TId, TProps> {
  private readonly _domainEvents: DomainEvent[] = [];

  protected constructor(id: TId, metadata: EntityMetadata, props: TProps) {
    super(id, metadata, props);
  }

  protected recordEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): readonly DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }
}

export { AggregateRoot };
