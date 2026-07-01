import { AppError } from "@repo/app-error";
import { test, expect } from "bun:test";
import { z } from "zod";

import { parseProps } from "./schema.ts";

const schema = z.object({ value: z.string().trim().min(1) });

test("parseProps: given valid input, it should return normalized data", () => {
  // GIVEN / WHEN
  const value = parseProps(schema, { value: "  hello  " });

  // THEN
  expect(value).toEqual({ value: "hello" });
});

test("parseProps: given invalid input, it should throw an InvariantViolation app error carrying the zod issues", () => {
  // GIVEN / WHEN
  let error: unknown;
  try {
    parseProps(schema, { value: "   " });
  } catch (caught) {
    error = caught;
  }

  // THEN
  expect(error).toBeInstanceOf(AppError);
  expect(AppError.from(error).code).toBe("serverKernel.invariantViolation");
  expect(Array.isArray(AppError.from(error).details?.issues)).toBe(true);
});
