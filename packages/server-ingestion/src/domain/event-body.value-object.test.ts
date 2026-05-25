import { test, expect } from "bun:test";

import { EventBody } from "./event-body.value-object.ts";

test("EventBody.create: given a non-empty payload, it should return ok", () => {
  // GIVEN / WHEN
  const result = EventBody.create({ text: "hello" });

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.toJSON()).toEqual({ text: "hello" });
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

test("EventBody.toJSON: given a returned object, it should be a copy", () => {
  // GIVEN
  const result = EventBody.create({ text: "hello" });
  if (!result.ok) throw new Error("expected ok");

  // WHEN
  const json = result.value.toJSON();
  json.text = "mutated";

  // THEN
  expect(result.value.toJSON()).toEqual({ text: "hello" });
});
