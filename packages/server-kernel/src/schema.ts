import type { PartialDeep } from "type-fest";

import { z } from "zod";

import { type DomainError, defineError } from "./domain-error.ts";

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
): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw error(z.prettifyError(parsed.error), {
    issues: parsed.error.issues,
  });
}
