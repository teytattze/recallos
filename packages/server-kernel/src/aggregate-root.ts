import type { EmptyObject, JsonObject } from "type-fest";

import type { DomainEvent } from "./domain-event.ts";
import type { Id } from "./id.ts";

import { Entity } from "./entity.ts";
import { EntityMetadata } from "./metadata.ts";

abstract class AggregateRoot<
  TId extends Id,
  TProps extends JsonObject = EmptyObject,
> extends Entity<TId, TProps> {
  private readonly _domainEvents: DomainEvent[] = [];

  protected _metadata: EntityMetadata;

  protected constructor(id: TId, metadata: EntityMetadata, props: TProps) {
    super(id, props);
    this._metadata = metadata;
  }

  protected touch(now: Date): void {
    this._metadata = this._metadata.touch(now);
  }

  protected recordEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Return events raised during mutation and clear the buffer so dispatch is
   * exactly-once per pull.
   */
  pullDomainEvents(): readonly DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }

  get metadata(): EntityMetadata {
    return this._metadata;
  }
}

export { AggregateRoot };
