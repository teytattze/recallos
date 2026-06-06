import { test, expect } from "bun:test";

import { EventId } from "./event-id.ts";

test("EventId.create: given two calls, it should produce distinct non-empty ids", () => {
  // GIVEN / WHEN
  const a = EventId.create();
  const b = EventId.create();

  // THEN
  expect(a.value.length).toBeGreaterThan(0);
  expect(a.value).not.toBe(b.value);
});

test("EventId.restore: given an existing value, it should wrap that value", () => {
  // GIVEN
  const value = "0190000000007000800090000a00000b";

  // WHEN
  const id = EventId.restore(value);

  // THEN
  expect(id.value).toBe(value);
});

test("EventId.equals: given the same value, it should be equal", () => {
  // GIVEN
  const value = "0190000000007000800090000a00000b";

  // WHEN / THEN
  expect(EventId.restore(value).equals(EventId.restore(value))).toBe(true);
});
