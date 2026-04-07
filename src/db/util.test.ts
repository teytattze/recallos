import { test, expect } from "bun:test";
import { newBaseFieldsValue } from "@/db/util";

test("newBaseFieldsValue: given no arguments, when called, then returns object with id property", () => {
  // Given / When
  const result = newBaseFieldsValue();

  // Then
  expect(result).toHaveProperty("id");
  expect(typeof result.id).toBe("string");
  expect(result.id.length).toBeGreaterThan(0);
});

test("newBaseFieldsValue: given no arguments, when called, then returns a valid UUIDv7 string", () => {
  // Given / When
  const result = newBaseFieldsValue();

  // Then
  const uuidv7Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  expect(result.id).toMatch(uuidv7Regex);
});

test("newBaseFieldsValue: given two calls, when compared, then returns distinct ids", () => {
  // Given
  const first = newBaseFieldsValue();
  const second = newBaseFieldsValue();

  // When / Then
  expect(first.id).not.toBe(second.id);
});
