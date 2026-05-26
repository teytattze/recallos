import { test, expect } from "bun:test";

import { Confidence } from "./confidence.value-object.ts";

test("Confidence.create: given the lower bound 0, it should return ok", () => {
  // GIVEN / WHEN
  const result = Confidence.create(0);

  // THEN
  expect(result.ok).toBe(true);
});

test("Confidence.create: given the upper bound 1, it should return ok", () => {
  // GIVEN / WHEN
  const result = Confidence.create(1);

  // THEN
  expect(result.ok).toBe(true);
});

test("Confidence.create: given a value within the range, it should return ok", () => {
  // GIVEN / WHEN
  const result = Confidence.create(0.42);

  // THEN
  expect(result.ok).toBe(true);
});

test("Confidence.create: given a value above 1, it should return an InvalidKnowledgeGraphEdge error", () => {
  // GIVEN / WHEN
  const result = Confidence.create(1.01);

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphEdge");
  expect(result.error.category).toBe("validation");
});

test("Confidence.create: given a value below 0, it should return an InvalidKnowledgeGraphEdge error", () => {
  // GIVEN / WHEN
  const result = Confidence.create(-0.01);

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphEdge");
});

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
