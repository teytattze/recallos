import { z } from "zod";

import { type DomainError, defineError } from "./domain-error.ts";
import { Result } from "./result.ts";

/**
 * Default error for a failed props invariant. A value object needing a
 * context-specific discriminant for exhaustive `switch`ing passes its own
 * {@link defineError} builder instead.
 */
export const InvariantViolation = defineError(
  "InvariantViolation",
  "validation",
);

type ErrorBuilder = (
  message: string,
  details?: Readonly<Record<string, unknown>>,
) => DomainError;

/**
 * Parse `input` against `schema` into a typed value or a `"validation"`
 * {@link DomainError} — the bridge for *expected* invariant failures.
 *
 * `details.issues` keeps zod's raw issues so a boundary can render field-level
 * errors without re-parsing the prettified message.
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
 * Parse `input` against `schema`, **throwing** on failure. For *impossible
 * states* only (an empty {@link Id}, a blank {@link Tenant} id) — a fault, not
 * a domain failure, so it never returns a {@link Result}.
 */
export function parsePropsOrThrow<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new Error(z.prettifyError(parsed.error));
}
