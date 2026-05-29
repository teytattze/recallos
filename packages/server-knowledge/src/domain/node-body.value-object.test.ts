import { test, expect } from "bun:test";

import { NodeBody } from "./node-body.value-object.ts";

const MAX_NODE_BODY_LENGTH = 10_000;

test.each([
  ["non-empty text", "Ada Lovelace"],
  ["text at the maximum length", "a".repeat(MAX_NODE_BODY_LENGTH)],
])("NodeBody.create: given %s, it should return ok", (_label, text) => {
  // GIVEN / WHEN
  const result = NodeBody.create(text);

  // THEN
  expect(result.ok).toBe(true);
});

test.each([
  ["empty text", ""],
  ["whitespace-only text", "   "],
  ["text longer than the maximum", "a".repeat(MAX_NODE_BODY_LENGTH + 1)],
])(
  "NodeBody.create: given %s, it should return an InvalidKnowledgeGraphNode error",
  (_label, text) => {
    // GIVEN / WHEN
    const result = NodeBody.create(text);

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidKnowledgeGraphNode");
    expect(result.error.category).toBe("validation");
  },
);

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
