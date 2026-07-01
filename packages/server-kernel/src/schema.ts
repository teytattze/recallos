import { AppError } from "@repo/app-error";
import { z } from "zod";

export function parseProps<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw AppError.ofCode("invariantViolation", {
    cause: parsed.error,
  });
}
