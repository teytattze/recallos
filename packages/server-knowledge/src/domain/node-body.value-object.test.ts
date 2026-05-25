import { expect, test } from "bun:test";

import { NodeBody } from "./node-body.value-object.ts";

test("NodeBody.create: given padded text, it should trim and succeed", () => {
  const result = NodeBody.create("  Alice Smith  ");

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.text).toBe("Alice Smith");
});

test("NodeBody.create: given blank text, it should fail with EmptyNodeBodyError", () => {
  const result = NodeBody.create("   ");

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("EmptyNodeBodyError");
});

test("NodeBody.create: given text past the max length, it should fail with NodeBodyTooLongError", () => {
  const result = NodeBody.create("a".repeat(NodeBody.MAX_LENGTH + 1));

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("NodeBodyTooLongError");
});
