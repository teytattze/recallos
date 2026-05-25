import { isEqual } from "es-toolkit";

/**
 * An immutable bundle of data with no identity: two value objects are equal when
 * their contents match, which is why {@link equals} compares props structurally.
 * Enforce invariants with a `zod` schema run through {@link parseProps} — the
 * props type is `z.infer`red from the schema (one source of truth) and `create`
 * returns a {@link Result}.
 */
export abstract class ValueObject<T extends Record<string, unknown>> {
  protected readonly _props: T;

  protected constructor(props: T) {
    this._props = props;
  }

  /** Value equality: same contents, compared structurally. */
  equals(other?: ValueObject<T>): boolean {
    if (other === undefined || other === null) return false;
    if (other === this) return true;
    return isEqual(this._props, other._props);
  }
}
