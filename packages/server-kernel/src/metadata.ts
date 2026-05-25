import { z } from "zod";

import { parsePropsOrThrow } from "./schema.ts";
import { ValueObject } from "./value-object.ts";

const metadataSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

type EntityMetadataProps = z.infer<typeof metadataSchema>;

/**
 * Audit timestamps every {@link AggregateRoot} carries: when it was first created
 * and when it last changed. Modelled as a {@link ValueObject} because it is a
 * structural bundle with no identity of its own.
 *
 * The instants are **domain data minted from a {@link Clock} at the use-case
 * boundary** and passed in — the pure core never reads the wall clock, exactly as
 * {@link DomainEvent}'s `occurredAt`. Being a value object it is immutable: a
 * change yields a new instance via {@link touch}, which the aggregate swaps in.
 *
 * A non-`Date` (or `Invalid Date`) instant is an impossible state, not a domain
 * failure, so construction runs `metadataSchema` through {@link parsePropsOrThrow}
 * and **throws** rather than returning a `Result`.
 */
export class EntityMetadata extends ValueObject<EntityMetadataProps> {
  private constructor(props: EntityMetadataProps) {
    super(parsePropsOrThrow(metadataSchema, props));
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  /** Stamp a freshly created aggregate: `createdAt` and `updatedAt` both `now`. */
  static create(now: Date): EntityMetadata {
    return new EntityMetadata({ createdAt: now, updatedAt: now });
  }

  /** Rehydrate metadata read back from persistence. */
  static restore(createdAt: Date, updatedAt: Date): EntityMetadata {
    return new EntityMetadata({ createdAt, updatedAt });
  }

  /** Return new metadata with `updatedAt` advanced to `now`; `createdAt` is kept. */
  touch(now: Date): EntityMetadata {
    return new EntityMetadata({
      createdAt: this._props.createdAt,
      updatedAt: now,
    });
  }
}
