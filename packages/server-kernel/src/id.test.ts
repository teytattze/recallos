import { test, expect } from "bun:test";

import { Id } from "./id.ts";

class TestId extends Id {
  static generate(): TestId {
    return new TestId(Id.newValue());
  }
  static from(value: string): TestId {
    return new TestId(value);
  }
}

test("Id.value: given a constructed id, it should return the wrapped string", () => {
  // GIVEN
  const id = TestId.from("abc");

  // WHEN / THEN
  expect(id.value).toBe("abc");
});

test("Id.toString: given a constructed id, it should return the wrapped string", () => {
  // GIVEN
  const id = TestId.from("abc");

  // WHEN / THEN
  expect(id.toString()).toBe("abc");
});

test("Id.generate: given two calls, it should produce distinct non-empty values", () => {
  // GIVEN / WHEN
  const a = TestId.generate();
  const b = TestId.generate();

  // THEN
  expect(a.value.length).toBeGreaterThan(0);
  expect(a.value).not.toBe(b.value);
});

test("Id constructor: given an empty value, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => TestId.from("")).toThrow();
});

test("Id.equals: given two ids with the same value, it should return true", () => {
  // GIVEN
  const a = TestId.from("same");
  const b = TestId.from("same");

  // WHEN / THEN
  expect(a.equals(b)).toBe(true);
});

test("Id.equals: given two ids with different values, it should return false", () => {
  // GIVEN
  const a = TestId.from("one");
  const b = TestId.from("two");

  // WHEN / THEN
  expect(a.equals(b)).toBe(false);
});
