import { test, expect } from "bun:test";

import { Entity } from "./entity.ts";
import { Id } from "./id.ts";

class TestId extends Id {
  static from(value: string): TestId {
    return new TestId(value);
  }
}

class TestEntity extends Entity<TestId, { name: string }> {
  static of(id: TestId, name: string): TestEntity {
    return new TestEntity(id, { name });
  }
  get name(): string {
    return this._props.name;
  }
  rename(name: string): void {
    this.replaceProps({ name });
  }
}

test("Entity.id: given a constructed entity, it should return the injected id", () => {
  // GIVEN
  const id = TestId.from("e1");
  const entity = TestEntity.of(id, "first");

  // WHEN / THEN
  expect(entity.id).toBe(id);
});

test("Entity.replaceProps: given new props, it should update the exposed value", () => {
  // GIVEN
  const entity = TestEntity.of(TestId.from("e1"), "first");

  // WHEN
  entity.rename("second");

  // THEN
  expect(entity.name).toBe("second");
});

test.each([
  [
    "the same instance",
    TestEntity.of(TestId.from("e1"), "first"),
    (entity: TestEntity) => entity,
  ],
  [
    "the same id but different props",
    TestEntity.of(TestId.from("e1"), "first"),
    () => TestEntity.of(TestId.from("e1"), "second"),
  ],
])("Entity.equals: given %s, it should return true", (_label, a, b) => {
  // GIVEN / WHEN / THEN
  expect(a.equals(b(a))).toBe(true);
});

test.each([
  [
    "a different id",
    TestEntity.of(TestId.from("e1"), "same"),
    TestEntity.of(TestId.from("e2"), "same"),
  ],
  ["undefined", TestEntity.of(TestId.from("e1"), "first"), undefined],
])("Entity.equals: given %s, it should return false", (_label, a, b) => {
  // GIVEN / WHEN / THEN
  expect(a.equals(b)).toBe(false);
});
