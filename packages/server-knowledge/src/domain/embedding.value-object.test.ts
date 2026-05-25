import { expect, test } from "bun:test";

import { Embedding } from "./embedding.value-object.ts";

test("Embedding.create: given a finite vector and model, it should derive dimensions from length", () => {
  const result = Embedding.create([0.1, 0.2, 0.3], "text-embedding-3-small");

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.dimensions).toBe(3);
  expect(result.value.model).toBe("text-embedding-3-small");
});

test("Embedding.create: given an empty vector, it should fail with EmptyEmbeddingError", () => {
  const result = Embedding.create([], "model");

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("EmptyEmbeddingError");
});

test("Embedding.create: given a non-finite component, it should fail with NonFiniteEmbeddingError", () => {
  const result = Embedding.create([0.1, Number.NaN], "model");

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("NonFiniteEmbeddingError");
});

test("Embedding.create: given a blank model, it should fail with MissingEmbeddingModelError", () => {
  const result = Embedding.create([0.1, 0.2], "   ");

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("MissingEmbeddingModelError");
});
