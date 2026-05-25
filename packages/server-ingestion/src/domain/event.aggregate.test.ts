import { test, expect } from "bun:test";

import { Event } from "./event.aggregate.ts";

const recordedAt = new Date("2026-01-02T00:00:00Z");
const occurredAt = new Date("2026-01-01T00:00:00Z");

const validProps = {
  occurredAt,
  tags: { source: "slack" },
  body: { text: "hello" },
};

test("Event.record: given valid props, it should return an Event carrying the inputs", () => {
  // GIVEN / WHEN
  const result = Event.record(validProps, recordedAt);

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.occurredAt).toEqual(occurredAt);
  expect(result.value.tags.get("source")).toBe("slack");
  expect(result.value.body.toJSON()).toEqual({ text: "hello" });
});

test("Event.record: given valid props, it should set recordedAt from the supplied instant", () => {
  // GIVEN / WHEN
  const result = Event.record(validProps, recordedAt);

  // THEN
  expect(result.ok && result.value.recordedAt).toEqual(recordedAt);
});

test("Event.record: given a fresh event, it should mint a distinct id each time", () => {
  // GIVEN / WHEN
  const a = Event.record(validProps, recordedAt);
  const b = Event.record(validProps, recordedAt);

  // THEN
  expect(a.ok && b.ok && a.value.id.value).not.toBe(
    b.ok ? b.value.id.value : "",
  );
});

test("Event.record: given occurredAt equal to recordedAt, it should be allowed", () => {
  // GIVEN / WHEN
  const result = Event.record(
    { ...validProps, occurredAt: recordedAt },
    recordedAt,
  );

  // THEN
  expect(result.ok).toBe(true);
});

test("Event.record: given occurredAt after recordedAt, it should return an InvalidEvent error", () => {
  // GIVEN
  const future = new Date(recordedAt.getTime() + 1000);

  // WHEN
  const result = Event.record(
    { ...validProps, occurredAt: future },
    recordedAt,
  );

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
});

test("Event.record: given an invalid occurredAt date, it should return an InvalidEvent error", () => {
  // GIVEN / WHEN
  const result = Event.record(
    { ...validProps, occurredAt: new Date("not-a-date") },
    recordedAt,
  );

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
});

test("Event.record: given an empty body, it should propagate the InvalidEvent error", () => {
  // GIVEN / WHEN
  const result = Event.record({ ...validProps, body: {} }, recordedAt);

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
});

test("Event.record: given a blank tag key, it should propagate the InvalidEvent error", () => {
  // GIVEN / WHEN
  const result = Event.record(
    { ...validProps, tags: { "  ": "x" } },
    recordedAt,
  );

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidEvent");
});
