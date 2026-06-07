import { test, expect } from "bun:test";

import { ValueObject } from "./value-object.ts";

type TestProps = { a: string; tags: string[]; at: Date };

class TestVO extends ValueObject<TestProps> {
  private constructor(props: TestProps) {
    super(props);
  }
  static of(a: string, tags: string[], at: Date): TestVO {
    return new TestVO({ a, tags, at });
  }
}

test.each([
  [
    "the same instance",
    TestVO.of("x", [], new Date(0)),
    (vo: TestVO) => vo,
  ],
  [
    "structurally equal props",
    TestVO.of("x", ["t1", "t2"], new Date("2026-01-01T00:00:00Z")),
    () => TestVO.of("x", ["t1", "t2"], new Date("2026-01-01T00:00:00Z")),
  ],
])("ValueObject.equals: given %s, it should return true", (_label, a, b) => {
  // GIVEN / WHEN / THEN
  expect(a.equals(b(a))).toBe(true);
});

test.each([
  ["undefined", TestVO.of("x", [], new Date(0)), undefined],
  [
    "a differing primitive",
    TestVO.of("x", ["t"], new Date(0)),
    TestVO.of("y", ["t"], new Date(0)),
  ],
  [
    "a differing array length",
    TestVO.of("x", ["t1", "t2"], new Date(0)),
    TestVO.of("x", ["t1"], new Date(0)),
  ],
  [
    "a differing Date time",
    TestVO.of("x", [], new Date("2026-01-01T00:00:00Z")),
    TestVO.of("x", [], new Date("2026-01-02T00:00:00Z")),
  ],
])("ValueObject.equals: given %s, it should return false", (_label, a, b) => {
  // GIVEN / WHEN / THEN
  expect(a.equals(b)).toBe(false);
});
