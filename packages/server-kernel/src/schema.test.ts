import { test, expect } from "bun:test";
import { z } from "zod";

import { defineError } from "./domain-error.ts";
import { parseProps } from "./schema.ts";

const schema = z.object({ value: z.string().trim().min(1) });

test("parseProps: given valid input, it should return normalized data", () => {
  // GIVEN / WHEN
  const value = parseProps(schema, { value: "  hello  " });

  // THEN
  expect(value).toEqual({ value: "hello" });
});

test("parseProps: given invalid input, it should throw a validation error carrying the zod issues", () => {
  // GIVEN / WHEN / THEN
  try {
    parseProps(schema, { value: "   " });
    throw new Error("Expected parseProps to throw");
  } catch (error) {
    expect(error).toMatchObject({
      category: "validation",
      kind: "InvariantViolation",
    });
    expect(
      Array.isArray(
        (error as { details?: { issues?: unknown } }).details?.issues,
      ),
    ).toBe(true);
  }
});

test("parseProps: given a custom error builder, it should throw an error with that builder's kind", () => {
  // GIVEN
  const CustomInvalid = defineError("CustomInvalid", "conflict");

  // WHEN / THEN
  expect(() => parseProps(schema, { value: "" }, CustomInvalid)).toThrow(
    expect.objectContaining({
      category: "conflict",
      kind: "CustomInvalid",
    }),
  );
});
