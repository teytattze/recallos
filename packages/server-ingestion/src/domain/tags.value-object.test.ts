import { test, expect } from "bun:test";

import { Tags } from "./tags.value-object.ts";

test("Tags.create: given mixed-case, padded keys, it should normalize them to trimmed lowercase", () => {
  // GIVEN / WHEN
  const padded = Tags.create({ "  Source ": "slack" });
  const canonical = Tags.create({ source: "slack" });

  // THEN
  expect(
    padded.ok && canonical.ok && padded.value.equals(canonical.value),
  ).toBe(true);
});

test("Tags.create: given padded values, it should trim them", () => {
  // GIVEN / WHEN
  const padded = Tags.create({ type: "  message  " });
  const canonical = Tags.create({ type: "message" });

  // THEN
  expect(
    padded.ok && canonical.ok && padded.value.equals(canonical.value),
  ).toBe(true);
});

test("Tags.create: given an empty input, it should return ok", () => {
  // GIVEN / WHEN
  const result = Tags.create({});

  // THEN
  expect(result.ok).toBe(true);
});

test("Tags.create: given a blank key, it should return an InvalidEvent error", () => {
  // GIVEN / WHEN
  const result = Tags.create({ "   ": "slack" });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
  expect(result.error.category).toBe("validation");
});

test("Tags.restore: given stored entries, it should equal the same Tags.create value", () => {
  // GIVEN
  const created = Tags.create({ source: "slack" });
  if (!created.ok) throw new Error("expected ok");

  // WHEN
  const restored = Tags.restore({ source: "slack" });

  // THEN
  expect(restored.equals(created.value)).toBe(true);
});

test("Tags.restore: given a blank tag key, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => Tags.restore({ "   ": "slack" })).toThrow();
});
