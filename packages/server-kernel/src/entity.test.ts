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

test("Entity.equals: given the same instance, it should return true", () => {
  // GIVEN
  const entity = TestEntity.of(TestId.from("e1"), "first");

  // WHEN / THEN
  expect(entity.equals(entity)).toBe(true);
});

test("Entity.equals: given the same id but different props, it should return true", () => {
  // GIVEN
  const a = TestEntity.of(TestId.from("e1"), "first");
  const b = TestEntity.of(TestId.from("e1"), "second");

  // WHEN / THEN
  expect(a.equals(b)).toBe(true);
});

test("Entity.equals: given a different id, it should return false", () => {
  // GIVEN
  const a = TestEntity.of(TestId.from("e1"), "same");
  const b = TestEntity.of(TestId.from("e2"), "same");

  // WHEN / THEN
  expect(a.equals(b)).toBe(false);
});

test("Entity.equals: given undefined, it should return false", () => {
  // GIVEN
  const entity = TestEntity.of(TestId.from("e1"), "first");

  // WHEN / THEN
  expect(entity.equals(undefined)).toBe(false);
});
