import { test, expect } from "bun:test";

import { EventId } from "./event-id.value-object.ts";

test("EventId.generate: given two calls, it should produce distinct non-empty ids", () => {
  // GIVEN / WHEN
  const a = EventId.generate();
  const b = EventId.generate();

  // THEN
  expect(a.value.length).toBeGreaterThan(0);
  expect(a.value).not.toBe(b.value);
});

test("EventId.from: given an existing value, it should wrap that value", () => {
  // GIVEN
  const value = "0190000000007000800090000a00000b";

  // WHEN
  const id = EventId.from(value);

  // THEN
  expect(id.value).toBe(value);
});

test("EventId.equals: given the same value, it should be equal", () => {
  // GIVEN
  const value = "0190000000007000800090000a00000b";

  // WHEN / THEN
  expect(EventId.from(value).equals(EventId.from(value))).toBe(true);
});
