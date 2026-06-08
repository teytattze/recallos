import { test, expect } from "bun:test";

import { GraphId } from "./graph-id.ts";

const value = "01952d3f-0000-7000-8000-000000000100";

test("GraphId.restore: given an existing value, it should wrap that value", () => {
  // GIVEN / WHEN
  const id = GraphId.restore({ payload: value });

  // THEN
  expect(id.value).toBe(value);
});

test("GraphId.equals: given the same value, it should be equal", () => {
  // GIVEN / WHEN / THEN
  expect(
    GraphId.restore({ payload: value }).equals(
      GraphId.restore({ payload: value }),
    ),
  ).toBe(true);
});

test("GraphId.restore: given an empty value, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => GraphId.restore({ payload: "" })).toThrow();
});
