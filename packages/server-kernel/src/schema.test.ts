import { test, expect } from "bun:test";
import { z } from "zod";

import { defineError } from "./domain-error.ts";
import { parseProps, parsePropsOrThrow } from "./schema.ts";

const schema = z.object({ value: z.string().trim().min(1) });

test("parseProps: given valid input, it should return ok with normalized data", () => {
  // GIVEN / WHEN
  const result = parseProps(schema, { value: "  hello  " });

  // THEN
  expect(result.ok).toBe(true);
  expect(result.ok && result.value).toEqual({ value: "hello" });
});

test("parseProps: given invalid input, it should return a validation err carrying the zod issues", () => {
  // GIVEN / WHEN
  const result = parseProps(schema, { value: "   " });

  // THEN
  expect(result.ok).toBe(false);
  expect(!result.ok && result.error.category).toBe("validation");
  expect(!result.ok && result.error.kind).toBe("InvariantViolation");
  expect(!result.ok && Array.isArray(result.error.details?.issues)).toBe(true);
});

test("parseProps: given a custom error builder, it should return an err with that builder's kind", () => {
  // GIVEN
  const CustomInvalid = defineError("CustomInvalid", "conflict");

  // WHEN
  const result = parseProps(schema, { value: "" }, CustomInvalid);

  // THEN
  expect(result.ok === false && result.error.kind).toBe("CustomInvalid");
  expect(result.ok === false && result.error.category).toBe("conflict");
});

test("parsePropsOrThrow: given valid input, it should return the typed value", () => {
  // GIVEN / WHEN
  const value = parsePropsOrThrow(schema, { value: "  hi  " });

  // THEN
  expect(value).toEqual({ value: "hi" });
});

test("parsePropsOrThrow: given invalid input, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => parsePropsOrThrow(schema, { value: "" })).toThrow();
});
