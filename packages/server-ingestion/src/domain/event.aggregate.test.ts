import { test, expect } from "bun:test";

import { Event } from "./event.aggregate.ts";

const recordedAt = new Date("2026-01-02T00:00:00Z");
const occurredAt = new Date("2026-01-01T00:00:00Z");

const validInput = {
  recordedAt,
  occurredAt,
  tags: { source: "slack" },
  body: { text: "hello" },
};

test("Event.create: given valid input, it should return an ok Event", () => {
  // GIVEN / WHEN
  const result = Event.create(validInput);

  // THEN
  expect(result.ok).toBe(true);
});

test("Event.create: given valid input, it should stamp recordedAt as the created-at metadata", () => {
  // GIVEN / WHEN
  const result = Event.create(validInput);

  // THEN
  expect(result.ok && result.value.metadata.createdAt).toEqual(recordedAt);
});

test("Event.create: given a fresh event, it should mint a distinct id each time", () => {
  // GIVEN / WHEN
  const a = Event.create(validInput);
  const b = Event.create(validInput);

  // THEN
  expect(a.ok && b.ok && a.value.id.value).not.toBe(
    b.ok ? b.value.id.value : "",
  );
});

test("Event.create: given occurredAt equal to recordedAt, it should be allowed", () => {
  // GIVEN / WHEN
  const result = Event.create({ ...validInput, occurredAt: recordedAt });

  // THEN
  expect(result.ok).toBe(true);
});

test.each([
  [
    "occurredAt after recordedAt",
    { occurredAt: new Date(recordedAt.getTime() + 1000) },
  ],
  ["an invalid occurredAt date", { occurredAt: new Date("not-a-date") }],
  ["an empty body", { body: {} }],
  ["a blank tag key", { tags: { "  ": "x" } }],
])(
  "Event.create: given %s, it should return an InvalidEvent error",
  (_label, patch) => {
    // GIVEN / WHEN
    const result = Event.create({ ...validInput, ...patch });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidEvent");
  },
);

const storedRow = {
  id: "01952d3f-0000-7000-8000-000000000000",
  recordedAt,
  updatedAt: new Date("2026-01-03T00:00:00Z"),
  occurredAt,
  tags: { source: "slack" },
  body: { text: "hello" },
};

test("Event.restore: given a stored row, it should preserve the id and audit timestamps", () => {
  // GIVEN / WHEN
  const event = Event.restore(storedRow);

  // THEN
  expect(event.id.value).toBe(storedRow.id);
  expect(event.metadata.createdAt).toEqual(storedRow.recordedAt);
  expect(event.metadata.updatedAt).toEqual(storedRow.updatedAt);
});

test("Event.restore: given a row with an empty body, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() => Event.restore({ ...storedRow, body: {} })).toThrow();
});
