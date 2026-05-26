import { test, expect } from "bun:test";

import { NodeBody } from "./node-body.value-object.ts";

const MAX_NODE_BODY_LENGTH = 10_000;

test("NodeBody.create: given non-empty text, it should return ok", () => {
  // GIVEN / WHEN
  const result = NodeBody.create("Ada Lovelace");

  // THEN
  expect(result.ok).toBe(true);
});

test("NodeBody.create: given empty text, it should return an InvalidKnowledgeGraphNode error", () => {
  // GIVEN / WHEN
  const result = NodeBody.create("");

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphNode");
  expect(result.error.category).toBe("validation");
});

test("NodeBody.create: given whitespace-only text, it should return an InvalidKnowledgeGraphNode error", () => {
  // GIVEN / WHEN
  const result = NodeBody.create("   ");

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphNode");
});

test("NodeBody.create: given text at the maximum length, it should return ok", () => {
  // GIVEN / WHEN
  const result = NodeBody.create("a".repeat(MAX_NODE_BODY_LENGTH));

  // THEN
  expect(result.ok).toBe(true);
});

test("NodeBody.create: given text longer than the maximum, it should return an InvalidKnowledgeGraphNode error", () => {
  // GIVEN / WHEN
  const result = NodeBody.create("a".repeat(MAX_NODE_BODY_LENGTH + 1));

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphNode");
});

test("NodeBody.create: given surrounding whitespace, it should trim before storing", () => {
  // GIVEN
  const created = NodeBody.create("  hello  ");
  if (!created.ok) throw new Error("expected ok");

  // WHEN / THEN
  expect(created.value.equals(NodeBody.restore("hello"))).toBe(true);
});

test("NodeBody.restore: given empty text, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => NodeBody.restore("")).toThrow();
});
