import { test, expect } from "bun:test";

import { EventBody } from "./event-body.value-object.ts";

test("EventBody.create: given a non-empty payload, it should return ok", () => {
  // GIVEN / WHEN
  const result = EventBody.create({ text: "hello" });

  // THEN
  expect(result.ok).toBe(true);
});

test("EventBody.create: given an empty payload, it should return an InvalidEvent error", () => {
  // GIVEN / WHEN
  const result = EventBody.create({});

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
  expect(result.error.category).toBe("validation");
});

test("EventBody.restore: given a stored body, it should equal the same EventBody.create value", () => {
  // GIVEN
  const created = EventBody.create({ text: "hello" });
  if (!created.ok) throw new Error("expected ok");

  // WHEN
  const restored = EventBody.restore({ text: "hello" });

  // THEN
  expect(restored.equals(created.value)).toBe(true);
});

test("EventBody.restore: given an empty body, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => EventBody.restore({})).toThrow();
});
