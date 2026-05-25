/**
 * Structural deep equality for the small, plain values a value object holds —
 * primitives, `Date`, arrays, and plain records nested arbitrarily. The kernel
 * leans on `zod` to validate `props` (see {@link parseProps}) but otherwise
 * avoids a general utility belt (no `es-toolkit`), so equality is hand-rolled
 * here. It is intentionally not a general-purpose `isEqual`: it does not handle
 * `Map`/`Set`/class instances, because a value object's `props` should only
 * ever be made of the shapes above.
 */
function deepEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (a instanceof Date || b instanceof Date) {
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEquals(item, b[index]));
  }

  if (
    typeof a === "object" &&
    typeof b === "object" &&
    a !== null &&
    b !== null
  ) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        deepEquals(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    );
  }

  return false;
}

/**
 * A value object: an immutable bundle of data with **no identity**. Two value
 * objects are equal when their contents are equal — an `Email` of `"a@b.com"`
 * is the same value as any other `Email` of `"a@b.com"`. Contrast with
 * {@link Entity}, which is equal only to itself regardless of its fields.
 *
 * Subclasses pass their validated `props` to `super(props)` and expose typed
 * getters. Treat `props` as frozen: a value object never mutates; an "update"
 * returns a new instance.
 *
 * The standard way to enforce a value object's invariant is a `zod` schema run
 * through {@link parseProps}: the props type is `z.infer`red from the schema
 * (one source of truth), the private constructor takes already-parsed props,
 * and `create` returns a `Result` whose `Err` is a `"validation"` DomainError.
 *
 * ```ts
 * const emailSchema = z.object({
 *   value: z.string().trim().toLowerCase().pipe(z.email()),
 * });
 * type EmailProps = z.infer<typeof emailSchema>;
 *
 * class Email extends ValueObject<EmailProps> {
 *   private constructor(props: EmailProps) {
 *     super(props);
 *   }
 *   get value() {
 *     return this._props.value;
 *   }
 *   static create(raw: string): Result<Email> {
 *     return Result.map(parseProps(emailSchema, { value: raw }), (p) => new Email(p));
 *   }
 * }
 * ```
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
    return deepEquals(this._props, other._props);
  }
}
