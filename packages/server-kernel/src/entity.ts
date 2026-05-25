import type { Id } from "./id.ts";

/**
 * An entity: a domain object defined by **identity**, not by its attributes.
 * Two entities are equal when they share the same {@link Id}, even if every
 * other field differs — a `User` whose email changed is still the same `User`.
 * This is the opposite of {@link ValueObject}, whose equality is structural.
 *
 * Like a value object, an entity keeps its state in a single `props` record
 * exposed to subclasses as `protected props`. Unlike a value object, those props
 * are *not* what defines the entity: only the explicit `id` participates in
 * equality, and the props are free to change over the entity's lifetime (model
 * mutable fields as non-readonly members of `T` and reassign them in place).
 *
 * Subclasses pass their id and validated props to `super(id, props)`. Entities
 * with no state beyond their identity rely on the default `T` and pass `{}`.
 * A mutating command re-runs the same props schema (an "update" can fail its
 * invariant just like construction) and swaps the validated props in via
 * {@link replaceProps}, so the entity is never left in an invalid state.
 *
 * ```ts
 * const renameSchema = z.object({ displayName: z.string().trim().min(1) });
 * type UserProps = z.infer<typeof renameSchema>;
 *
 * class User extends Entity<UserId, UserProps> {
 *   private constructor(id: UserId, props: UserProps) {
 *     super(id, props);
 *   }
 *   get displayName() {
 *     return this._props.displayName;
 *   }
 *   rename(displayName: string): Result<void> {
 *     const parsed = parseProps(renameSchema, { ...this._props, displayName });
 *     if (!parsed.ok) return parsed;
 *     this.replaceProps(parsed.value);
 *     return Result.ok(undefined);
 *   }
 * }
 * ```
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
   * Swap in a new, already-validated props record after a mutating command has
   * re-run its schema. The single audited place the entity's mutable state is
   * reassigned: it merges `next` over the current props in place, keeping the
   * `_props` reference stable. Subclasses must parse before calling this — it
   * performs no validation of its own.
   */
  protected replaceProps(next: T): void {
    Object.assign(this._props as Record<string, unknown>, next);
  }

  /** Identity equality: same type of entity with an equal id. */
  equals(other?: Entity<TId, T>): boolean {
    if (other === undefined || other === null) return false;
    if (other === this) return true;
    return this._id.equals(other._id);
  }
}
