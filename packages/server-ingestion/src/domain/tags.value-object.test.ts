import { test, expect } from "bun:test";

import { Tags } from "./tags.value-object.ts";

test("Tags.create: given mixed-case, padded keys, it should normalize them to trimmed lowercase", () => {
  // GIVEN / WHEN
  const result = Tags.create({ "  Source ": "slack" });

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.toRecord()).toEqual({ source: "slack" });
});

test("Tags.create: given padded values, it should trim them", () => {
  // GIVEN / WHEN
  const result = Tags.create({ type: "  message  " });

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.get("type")).toBe("message");
});

test("Tags.create: given an empty input, it should return empty tags", () => {
  // GIVEN / WHEN
  const result = Tags.create({});

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.toRecord()).toEqual({});
});

test("Tags.create: given a blank key, it should return an InvalidEvent error", () => {
  // GIVEN / WHEN
  const result = Tags.create({ "   ": "slack" });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
  expect(result.error.category).toBe("validation");
});

test("Tags.get: given a key in different case, it should resolve case-insensitively", () => {
  // GIVEN
  const result = Tags.create({ source: "slack" });

  // WHEN / THEN
  expect(result.ok && result.value.get("SOURCE")).toBe("slack");
});

test("Tags.toRecord: given a returned record, it should be a copy", () => {
  // GIVEN
  const result = Tags.create({ source: "slack" });
  if (!result.ok) throw new Error("expected ok");

  // WHEN
  const record = result.value.toRecord();
  record.source = "mutated";

  // THEN
  expect(result.value.get("source")).toBe("slack");
});
