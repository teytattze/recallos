import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { test, expect } from "bun:test";

import { Event } from "./event.ts";

const createdAt = new Date("2026-01-02T00:00:00Z");
const occurredAt = new Date("2026-01-01T00:00:00Z");
const tenant = Tenant.create("organization", "org1");
const metadata = EntityMetadata.create(createdAt);
const graphId = "01952d3f-0000-7000-8000-000000000100";

type EventPayload = {
  occurredAt: Date;
  tags: Record<string, string>;
  body: Record<string, unknown>;
  graphId: string;
};

const validPayload: EventPayload = {
  occurredAt,
  tags: { source: "slack" },
  body: { text: "hello" },
  graphId,
};
const validInput = {
  tenant,
  metadata,
  payload: validPayload,
};

test("Event.create: given valid input, it should return an ok Event", () => {
  // GIVEN / WHEN
  const result = Event.create(validInput);

  // THEN
  expect(result.ok).toBe(true);
});

test("Event.create: given valid input, it should stamp createdAt as the created-at metadata", () => {
  // GIVEN / WHEN
  const result = Event.create(validInput);

  // THEN
  expect(result.ok && result.value.metadata.createdAt).toEqual(createdAt);
});

test("Event.create: given valid input, it should preserve the tenant", () => {
  // GIVEN / WHEN
  const result = Event.create(validInput);

  // THEN
  expect(result.ok && result.value.tenant).toBe(tenant);
});

test("Event.create: given valid input, it should preserve the graph id", () => {
  // GIVEN / WHEN
  const result = Event.create(validInput);

  // THEN
  expect(result.ok && result.value.graphId.value).toBe(graphId);
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

test("Event.create: given occurredAt equal to createdAt, it should be allowed", () => {
  // GIVEN / WHEN
  const result = Event.create({
    ...validInput,
    payload: { ...validInput.payload, occurredAt: createdAt },
  });

  // THEN
  expect(result.ok).toBe(true);
});

test.each([
  [
    "occurredAt after createdAt",
    { occurredAt: new Date(createdAt.getTime() + 1000) },
  ],
  ["an invalid occurredAt date", { occurredAt: new Date("not-a-date") }],
  ["an empty body", { body: {} }],
  ["a blank tag key", { tags: { "  ": "x" } }],
])(
  "Event.create: given %s, it should return an InvalidEvent error",
  (_label, patch: Partial<EventPayload>) => {
    // GIVEN / WHEN
    const result = Event.create({
      ...validInput,
      payload: { ...validInput.payload, ...patch },
    });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidEvent");
  },
);

const updatedAt = new Date("2026-01-03T00:00:00Z");
const storedInput = {
  tenant,
  metadata: EntityMetadata.restore(createdAt, updatedAt),
  payload: {
    id: "01952d3f-0000-7000-8000-000000000000",
    occurredAt,
    tags: { source: "slack" },
    body: { text: "hello" },
    graphId,
  },
};

test("Event.restore: given a stored row, it should preserve the id and audit timestamps", () => {
  // GIVEN / WHEN
  const event = Event.restore(storedInput);

  // THEN
  expect(event.id.value).toBe(storedInput.payload.id);
  expect(event.metadata.createdAt).toEqual(storedInput.metadata.createdAt);
  expect(event.metadata.updatedAt).toEqual(storedInput.metadata.updatedAt);
});

test("Event.restore: given a stored row, it should restore the tenant", () => {
  // GIVEN / WHEN
  const event = Event.restore(storedInput);

  // THEN
  expect(event.tenant.equals(tenant)).toBe(true);
});

test("Event.restore: given a stored row, it should restore the graph id", () => {
  // GIVEN / WHEN
  const event = Event.restore(storedInput);

  // THEN
  expect(event.graphId.value).toBe(graphId);
});

test("Event.restore: given a row with an empty body, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    Event.restore({
      ...storedInput,
      payload: { ...storedInput.payload, body: {} },
    }),
  ).toThrow();
});
