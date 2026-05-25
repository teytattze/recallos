import type { Id } from "./id.ts";

/**
 * Domain object identified by its {@link Id}: two entities are equal when their
 * ids match, regardless of other fields, which may change over the entity's
 * lifetime. A mutating command re-runs the props schema and swaps the result in
 * via {@link replaceProps}, so the entity is never left invalid.
 */
export abstract class Entity<
  TId extends Id,
  T extends Record<string, unknown> = Record<string, never>,
> {
  protected readonly _id: TId;
  protected readonly _props: T;

  protected constructor(id: TId, props: T) {
    this._id = id;
    this._props = props;
  }

  get id(): TId {
    return this._id;
  }

  /**
   * Swap in already-validated props — the single place mutable state is
   * reassigned. Merges in place (keeps the `_props` reference stable) and does
   * **not** validate; callers must parse first.
   */
  protected replaceProps(next: T): void {
    Object.assign(this._props as Record<string, unknown>, next);
  }

  /** Identity equality: equal when ids match. */
  equals(other?: Entity<TId, T>): boolean {
    if (other === undefined || other === null) return false;
    if (other === this) return true;
    return this._id.equals(other._id);
  }
}
