import { test, expect } from "bun:test";

import { Embedding } from "./embedding.value-object.ts";

test("Embedding.create: given a non-empty vector, it should return ok", () => {
  // GIVEN / WHEN
  const result = Embedding.create([0.1, 0.2, 0.3], "text-embedding-3-small");

  // THEN
  expect(result.ok).toBe(true);
});

test("Embedding.create: given a vector, it should derive dimensions from the vector length", () => {
  // GIVEN
  const created = Embedding.create([0.1, 0.2, 0.3], "text-embedding-3-small");
  if (!created.ok) throw new Error("expected ok");

  // WHEN / THEN
  expect(
    created.value.equals(
      Embedding.restore([0.1, 0.2, 0.3], "text-embedding-3-small", 3),
    ),
  ).toBe(true);
});

test.each([
  ["an empty vector", [] as number[], "text-embedding-3-small"],
  ["a blank model", [0.1, 0.2], "   "],
])(
  "Embedding.create: given %s, it should return an InvalidKnowledgeGraphNode error",
  (_label, vector, model) => {
    // GIVEN / WHEN
    const result = Embedding.create(vector, model);

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidKnowledgeGraphNode");
    expect(result.error.category).toBe("validation");
  },
);

test("Embedding.restore: given non-positive dimensions, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => Embedding.restore([0.1], "text-embedding-3-small", 0)).toThrow();
});

test("Embedding.restore: given an empty vector, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => Embedding.restore([], "text-embedding-3-small", 1)).toThrow();
});
