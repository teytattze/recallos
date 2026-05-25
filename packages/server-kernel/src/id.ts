import { z } from "zod";

import { parsePropsOrThrow } from "./schema.ts";
import { ValueObject } from "./value-object.ts";

const idSchema = z.object({ value: z.string().min(1) });

/**
 * The identity of an entity, wrapping a single string. Concrete ids subclass
 * this so identities of different aggregates are distinct types — a
 * `MemoryItemId` can't be passed where a `SourceId` is expected. An empty id is
 * an impossible state, so the constructor runs through {@link parsePropsOrThrow}
 * and **throws** rather than returning a {@link Result}.
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
   * Randomness is fine for identity (an id has no meaning to reconstruct); if a
   * context later needs deterministic ids, inject an id-generator port instead.
   */
  protected static newValue(): string {
    return Bun.randomUUIDv7();
  }
}
