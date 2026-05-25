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

test("ValueObject.equals: given undefined, it should return false", () => {
  // GIVEN
  const vo = TestVO.of("x", [], new Date(0));

  // WHEN / THEN
  expect(vo.equals(undefined)).toBe(false);
});

test("ValueObject.equals: given the same instance, it should return true", () => {
  // GIVEN
  const vo = TestVO.of("x", [], new Date(0));

  // WHEN / THEN
  expect(vo.equals(vo)).toBe(true);
});

test("ValueObject.equals: given structurally equal props, it should return true", () => {
  // GIVEN
  const a = TestVO.of("x", ["t1", "t2"], new Date("2026-01-01T00:00:00Z"));
  const b = TestVO.of("x", ["t1", "t2"], new Date("2026-01-01T00:00:00Z"));

  // WHEN / THEN
  expect(a.equals(b)).toBe(true);
});

test("ValueObject.equals: given a differing primitive, it should return false", () => {
  // GIVEN
  const a = TestVO.of("x", ["t"], new Date(0));
  const b = TestVO.of("y", ["t"], new Date(0));

  // WHEN / THEN
  expect(a.equals(b)).toBe(false);
});

test("ValueObject.equals: given a differing array length, it should return false", () => {
  // GIVEN
  const a = TestVO.of("x", ["t1", "t2"], new Date(0));
  const b = TestVO.of("x", ["t1"], new Date(0));

  // WHEN / THEN
  expect(a.equals(b)).toBe(false);
});

test("ValueObject.equals: given a differing Date time, it should return false", () => {
  // GIVEN
  const a = TestVO.of("x", [], new Date("2026-01-01T00:00:00Z"));
  const b = TestVO.of("x", [], new Date("2026-01-02T00:00:00Z"));

  // WHEN / THEN
  expect(a.equals(b)).toBe(false);
});
