import { test, expect } from "bun:test";

import { Tags } from "./tags.value-object.ts";

test.each([
  ["mixed-case, padded keys", { "  Source ": "slack" }, { source: "slack" }],
  ["padded values", { type: "  message  " }, { type: "message" }],
])(
  "Tags.create: given %s, it should normalize to the canonical form",
  (_label, padded, canonical) => {
    // GIVEN / WHEN
    const paddedTags = Tags.create(padded);
    const canonicalTags = Tags.create(canonical);

    // THEN
    expect(
      paddedTags.ok &&
        canonicalTags.ok &&
        paddedTags.value.equals(canonicalTags.value),
    ).toBe(true);
  },
);

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
