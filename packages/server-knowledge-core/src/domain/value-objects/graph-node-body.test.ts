import { test, expect } from "bun:test";

import { GraphNodeBody } from "./graph-node-body.ts";

const MAX_NODE_BODY_LENGTH = 10_000;

test.each([
  ["non-empty text", "Ada Lovelace"],
  ["text at the maximum length", "a".repeat(MAX_NODE_BODY_LENGTH)],
])("GraphNodeBody.create: given %s, it should return ok", (_label, text) => {
  // GIVEN / WHEN
  const result = GraphNodeBody.create({ payload: text });

  // THEN
  expect(result.ok).toBe(true);
});

test.each([
  ["empty text", ""],
  ["whitespace-only text", "   "],
  ["text longer than the maximum", "a".repeat(MAX_NODE_BODY_LENGTH + 1)],
])(
  "GraphNodeBody.create: given %s, it should return an InvalidGraphNode error",
  (_label, text) => {
    // GIVEN / WHEN
    const result = GraphNodeBody.create({ payload: text });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidGraphNode");
    expect(result.error.category).toBe("validation");
  },
);

test("GraphNodeBody.create: given surrounding whitespace, it should trim before storing", () => {
  // GIVEN
  const created = GraphNodeBody.create({ payload: "  hello  " });
  if (!created.ok) throw new Error("expected ok");

  // WHEN / THEN
  expect(created.value.equals(GraphNodeBody.restore({ payload: "hello" }))).toBe(
    true,
  );
});

test("GraphNodeBody.restore: given empty text, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => GraphNodeBody.restore({ payload: "" })).toThrow();
});
