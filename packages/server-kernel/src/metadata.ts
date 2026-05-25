import { z } from "zod";

import { parsePropsOrThrow } from "./schema.ts";
import { ValueObject } from "./value-object.ts";

const metadataSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

type EntityMetadataProps = z.infer<typeof metadataSchema>;

/**
 * Audit timestamps every {@link AggregateRoot} carries. The instants are minted
 * from a {@link Clock} at the use-case boundary, never read from the wall clock
 * in the pure core. An invalid instant is an impossible state, so construction
 * runs through {@link parsePropsOrThrow} and **throws** rather than returning a
 * {@link Result}.
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
