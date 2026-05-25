import { z } from "zod";

import { parsePropsOrThrow } from "./schema.ts";
import { ValueObject } from "./value-object.ts";

const idSchema = z.object({ value: z.string().min(1) });

/**
 * The identity of an entity, modelled as a value object wrapping a single
 * string. Concrete ids subclass this so identities of different aggregates are
 * distinct types — a `MemoryItemId` can never be passed where a `SourceId` is
 * expected, even though both wrap a string.
 *
 * ```ts
 * class MemoryItemId extends Id {
 *   static generate(): MemoryItemId {
 *     return new MemoryItemId(Id.newValue());
 *   }
 *   static from(value: string): MemoryItemId {
 *     return new MemoryItemId(value);
 *   }
 * }
 * ```
 *
 * An empty id is an impossible state, not an expected domain failure, so the
 * constructor runs `idSchema` through {@link parsePropsOrThrow} and **throws**
 * rather than returning a `Result`.
 */
export abstract class Id extends ValueObject<{ value: string }> {
  protected constructor(value: string) {
    super(parsePropsOrThrow(idSchema, { value }));
  }

  get value(): string {
    return this._props.value;
  }

  override toString(): string {
    return this._props.value;
  }

  /**
   * Mint a fresh, globally-unique id string for a subclass `generate()` to wrap.
   * Uses `crypto.randomUUID()`: randomness is acceptable for identity minting
   * (an id has no meaning to reconstruct). If a context later needs deterministic
   * ids, inject an id-generator port instead of calling this.
   */
  protected static newValue(): string {
    return Bun.randomUUIDv7();
  }
}
