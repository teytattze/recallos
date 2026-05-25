import { z } from "zod";

import { type DomainError, defineError } from "./domain-error.ts";
import { Result } from "./result.ts";

/**
 * The bridge from a `zod` schema to the kernel's invariant conventions. A value
 * object or entity declares a schema for its `props`, derives the props type
 * from it with `z.infer` (single source of truth), and runs the schema in its
 * factory — {@link parseProps} when a malformed value is an *expected* domain
 * failure, {@link parsePropsOrThrow} when it is an *impossible* state.
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

/**
 * The default error a failed props invariant carries. A value object that needs
 * a context-specific discriminant — so it can union its errors and `switch`
 * over them exhaustively — passes its own {@link defineError} builder to
 * {@link parseProps} instead (e.g. `defineError("EmailInvalid", "validation")`).
 */
export const InvariantViolation = defineError(
  "InvariantViolation",
  "validation",
);

/** Builds a {@link DomainError} from a human message plus the offending issues. */
type ErrorBuilder = (
  message: string,
  details?: Readonly<Record<string, unknown>>,
) => DomainError;

/**
 * Parse `input` against `schema`, returning the typed (and normalized) value on
 * success or a `"validation"`-category {@link DomainError} on failure. This is
 * the standard bridge for **expected** invariant failures — a value object's
 * `create` factory hands the {@link Result} straight back to the caller.
 *
 * `message` is `z.prettifyError`'s readable multi-line summary; `details.issues`
 * preserves zod's raw issue array (`{ path, message, code }`) so a boundary can
 * render field-level errors without re-parsing the string.
 */
export function parseProps<S extends z.ZodType>(
  schema: S,
  input: unknown,
  error: ErrorBuilder = InvariantViolation,
): Result<z.infer<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return Result.ok(parsed.data);
  return Result.err(
    error(z.prettifyError(parsed.error), { issues: parsed.error.issues }),
  );
}

/**
 * Parse `input` against `schema`, returning the typed value or **throwing**.
 * For *impossible states* only — values a correct program can never produce
 * (an empty {@link Id}, a blank {@link Tenant} id, metadata minted off a
 * {@link Clock}). Mirrors how `loadConfig` fails fast: an invariant this strict
 * is a fault, not a domain failure, so it never returns a {@link Result}.
 */
export function parsePropsOrThrow<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new Error(z.prettifyError(parsed.error));
}
