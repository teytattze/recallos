import { test, expect } from "bun:test";

import { EntityMetadata } from "./metadata.ts";

test("EntityMetadata.create: given now, it should set createdAt and updatedAt to now", () => {
  // GIVEN
  const now = new Date("2026-01-01T00:00:00Z");

  // WHEN
  const metadata = EntityMetadata.create({ payload: { now } });

  // THEN
  expect(metadata.createdAt).toEqual(now);
  expect(metadata.updatedAt).toEqual(now);
});

test("EntityMetadata.restore: given explicit dates, it should return them through the getters", () => {
  // GIVEN
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const updatedAt = new Date("2026-02-01T00:00:00Z");

  // WHEN
  const metadata = EntityMetadata.restore({ payload: { createdAt, updatedAt } });

  // THEN
  expect(metadata.createdAt).toEqual(createdAt);
  expect(metadata.updatedAt).toEqual(updatedAt);
});

test("EntityMetadata.touch: given a later instant, it should return advanced metadata without mutating the original", () => {
  // GIVEN
  const created = new Date("2026-01-01T00:00:00Z");
  const later = new Date("2026-03-01T00:00:00Z");
  const original = EntityMetadata.create({ payload: { now: created } });

  // WHEN
  const touched = original.touch(later);

  // THEN
  expect(touched.createdAt).toEqual(created);
  expect(touched.updatedAt).toEqual(later);
  expect(touched).not.toBe(original);
  expect(original.updatedAt).toEqual(created);
});

test("EntityMetadata.equals: given the same dates, it should return true", () => {
  // GIVEN
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const updatedAt = new Date("2026-02-01T00:00:00Z");

  // WHEN / THEN
  expect(
    EntityMetadata.restore({ payload: { createdAt, updatedAt } }).equals(
      EntityMetadata.restore({ payload: { createdAt, updatedAt } }),
    ),
  ).toBe(true);
});
