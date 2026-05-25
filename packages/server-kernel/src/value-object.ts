import { isEqual } from "es-toolkit";

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
    return isEqual(this._props, other._props);
  }
}
