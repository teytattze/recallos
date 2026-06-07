import { test, expect } from "bun:test";

import { Embedding } from "./embedding.ts";

test("Embedding.create: given a non-empty vector, it should return ok and derive dimensions", () => {
  // GIVEN / WHEN
  const result = Embedding.create({
    payload: {
      vector: [0.1, 0.2, 0.3],
      model: "text-embedding-3-small",
    },
  });

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(
    result.value.equals(
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
  "Embedding.create: given %s, it should return an InvalidGraphNode error",
  (_label, vector, model) => {
    // GIVEN / WHEN
    const result = Embedding.create({ payload: { vector, model } });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidGraphNode");
    expect(result.error.category).toBe("validation");
  },
);

test.each([
  ["non-positive dimensions", { vector: [0.1], dimensions: 0 }],
  ["an empty vector", { vector: [], dimensions: 1 }],
])("Embedding.restore: given %s, it should throw", (_label, patch) => {
  // GIVEN / WHEN / THEN
  expect(() =>
    Embedding.restore({
      payload: {
        model: "text-embedding-3-small",
        ...patch,
      },
    }),
  ).toThrow();
});
