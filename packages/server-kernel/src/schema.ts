import { z } from "zod";

import { type DomainError, defineError } from "./domain-error.ts";
import { errResult, okResult, type Result } from "./result.ts";

export const InvariantViolation = defineError(
  "InvariantViolation",
  "validation",
);

type ErrorBuilder = (
  message: string,
  details?: Readonly<Record<string, unknown>>,
) => DomainError<string>;

export function parseProps<S extends z.ZodType>(
  schema: S,
  input: unknown,
  error: ErrorBuilder = InvariantViolation,
): Result<z.infer<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return okResult(parsed.data);
  return errResult(
    error(z.prettifyError(parsed.error), { issues: parsed.error.issues }),
  );
}

export function parsePropsOrThrow<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new Error(z.prettifyError(parsed.error));
}
