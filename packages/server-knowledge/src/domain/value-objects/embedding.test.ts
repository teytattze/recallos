import { test, expect } from "bun:test";

import { Embedding } from "./embedding.ts";

test("Embedding.create: given a non-empty vector, it should return ok", () => {
  // GIVEN / WHEN
  const result = Embedding.create({
    payload: {
      vector: [0.1, 0.2, 0.3],
      model: "text-embedding-3-small",
    },
  });

  // THEN
  expect(result.ok).toBe(true);
});

test("Embedding.create: given a vector, it should derive dimensions from the vector length", () => {
  // GIVEN
  const created = Embedding.create({
    payload: {
      vector: [0.1, 0.2, 0.3],
      model: "text-embedding-3-small",
    },
  });
  if (!created.ok) throw new Error("expected ok");

  // WHEN / THEN
  expect(
    created.value.equals(
      Embedding.restore({
        payload: {
          vector: [0.1, 0.2, 0.3],
          model: "text-embedding-3-small",
          dimensions: 3,
        },
      }),
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
    const result = Embedding.create({ payload: { vector, model } });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidKnowledgeGraphNode");
    expect(result.error.category).toBe("validation");
  },
);

test("Embedding.restore: given non-positive dimensions, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    Embedding.restore({
      payload: {
        vector: [0.1],
        model: "text-embedding-3-small",
        dimensions: 0,
      },
    }),
  ).toThrow();
});

test("Embedding.restore: given an empty vector, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    Embedding.restore({
      payload: {
        vector: [],
        model: "text-embedding-3-small",
        dimensions: 1,
      },
    }),
  ).toThrow();
});
