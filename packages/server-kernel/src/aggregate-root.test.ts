import { test, expect } from "bun:test";

import type { DomainEvent } from "./domain-event.ts";

import { AggregateRoot } from "./aggregate-root.ts";
import { Id } from "./id.ts";
import { EntityMetadata } from "./metadata.ts";

class TestId extends Id {
  static from(value: string): TestId {
    return new TestId(value);
  }
}

const event = (eventName: string, aggregateId: string): DomainEvent => ({
  eventName,
  aggregateId,
  createdAt: new Date("2026-01-01T00:00:00Z"),
});

class TestAgg extends AggregateRoot<TestId, { n: number }> {
  static of(id: TestId, metadata: EntityMetadata, n: number): TestAgg {
    return new TestAgg(id, metadata, { n });
  }
  bump(now: Date): void {
    this.touch(now);
  }
  raise(e: DomainEvent): void {
    this.recordEvent(e);
  }
}

const fixedMeta = EntityMetadata.create(new Date("2026-01-01T00:00:00Z"));

test("AggregateRoot.metadata: given a constructed aggregate, it should return the injected metadata", () => {
  // GIVEN
  const agg = TestAgg.of(TestId.from("a1"), fixedMeta, 1);

  // WHEN / THEN
  expect(agg.metadata).toBe(fixedMeta);
});

test("AggregateRoot.touch: given a later instant, it should advance updatedAt and keep createdAt", () => {
  // GIVEN
  const created = new Date("2026-01-01T00:00:00Z");
  const later = new Date("2026-03-01T00:00:00Z");
  const agg = TestAgg.of(TestId.from("a1"), EntityMetadata.create(created), 1);

  // WHEN
  agg.bump(later);

  // THEN
  expect(agg.metadata.createdAt).toEqual(created);
  expect(agg.metadata.updatedAt).toEqual(later);
});

test("AggregateRoot.pullDomainEvents: given recorded events, it should return them in order", () => {
  // GIVEN
  const agg = TestAgg.of(TestId.from("a1"), fixedMeta, 1);
  agg.raise(event("First", "a1"));
  agg.raise(event("Second", "a1"));

  // WHEN
  const events = agg.pullDomainEvents();

  // THEN
  expect(events.map((e) => e.eventName)).toEqual(["First", "Second"]);
});

test("AggregateRoot.pullDomainEvents: given a prior drain, it should return an empty buffer on the second call", () => {
  // GIVEN
  const agg = TestAgg.of(TestId.from("a1"), fixedMeta, 1);
  agg.raise(event("First", "a1"));
  agg.pullDomainEvents();

  // WHEN
  const second = agg.pullDomainEvents();

  // THEN
  expect(second).toEqual([]);
});

test("AggregateRoot.equals: given the same id, it should return true (id-based)", () => {
  // GIVEN
  const a = TestAgg.of(TestId.from("a1"), fixedMeta, 1);
  const b = TestAgg.of(TestId.from("a1"), fixedMeta, 99);

  // WHEN / THEN
  expect(a.equals(b)).toBe(true);
});
