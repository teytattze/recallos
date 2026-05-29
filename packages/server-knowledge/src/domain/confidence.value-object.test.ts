import { test, expect } from "bun:test";

import { Confidence } from "./confidence.value-object.ts";

test.each([
  ["the lower bound 0", 0],
  ["the upper bound 1", 1],
  ["a value within the range", 0.42],
])("Confidence.create: given %s, it should return ok", (_label, value) => {
  // GIVEN / WHEN
  const result = Confidence.create(value);

  // THEN
  expect(result.ok).toBe(true);
});

test.each([
  ["a value above 1", 1.01],
  ["a value below 0", -0.01],
])(
  "Confidence.create: given %s, it should return an InvalidKnowledgeGraphEdge error",
  (_label, value) => {
    // GIVEN / WHEN
    const result = Confidence.create(value);

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidKnowledgeGraphEdge");
    expect(result.error.category).toBe("validation");
  },
);

test("Confidence.restore: given a stored value, it should equal the same Confidence.create value", () => {
  // GIVEN
  const created = Confidence.create(0.5);
  if (!created.ok) throw new Error("expected ok");

  // WHEN / THEN
  expect(Confidence.restore(0.5).equals(created.value)).toBe(true);
});

test("Confidence.restore: given an out-of-range value, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => Confidence.restore(2)).toThrow();
});
