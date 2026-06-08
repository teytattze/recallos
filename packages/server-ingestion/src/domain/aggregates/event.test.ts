import type { JsonObject } from "type-fest";

import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { test, expect } from "bun:test";

import type { EventExternalPropsIn } from "../value-objects/event-external.ts";

import { Event } from "./event.ts";

const createdAt = new Date("2026-01-02T00:00:00Z");
const updatedAt = new Date("2026-01-03T00:00:00Z");
const tenant = Tenant.create("organization", "org1");
const metadata = EntityMetadata.create(createdAt);
const graphId = "01952d3f-0000-7000-8000-000000000100";
const external = {
  id: "jira-123",
  provider: "jira",
} satisfies EventExternalPropsIn;
const raw = {
  issue: { key: "REC-123", summary: "hello" },
} satisfies JsonObject;

type EventPayload = {
  external: EventExternalPropsIn;
  graphId: string;
  raw: JsonObject;
};

const validPayload: EventPayload = {
  external,
  graphId,
  raw,
};
const validInput = {
  tenant,
  metadata,
  payload: validPayload,
};

test("Event.create: given valid input, it should return an Event with metadata and ownership", () => {
  // GIVEN / WHEN
  const result = Event.create(validInput);

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.metadata.createdAt).toEqual(createdAt);
  expect(result.value.tenant).toBe(tenant);
  expect(String(result.value.external.toJSON().id)).toBe(external.id);
  expect(String(result.value.external.toJSON().provider)).toBe(
    external.provider,
  );
  expect(result.value.graphId.value).toBe(graphId);
  expect(result.value.raw).toEqual(raw);
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

test.each([
  {
    label: "an unsupported external provider",
    payload: {
      ...validPayload,
      external: { id: "jira-123", provider: "github" },
    } as unknown as EventPayload,
  },
  {
    label: "an invalid raw payload",
    payload: {
      ...validPayload,
      raw: { notJson: undefined },
    } as unknown as EventPayload,
  },
])(
  "Event.create: given $label, it should return an InvalidEvent error",
  ({ payload }) => {
    // GIVEN / WHEN
    const result = Event.create({
      ...validInput,
      payload,
    });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidEvent");
  },
);

const storedInput = {
  tenant,
  metadata: EntityMetadata.restore(createdAt, updatedAt),
  payload: {
    id: "01952d3f-0000-7000-8000-000000000000",
    external,
    graphId,
    raw,
  },
};

test("Event.restore: given a stored row, it should preserve persisted identity and ownership", () => {
  // GIVEN / WHEN
  const event = Event.restore(storedInput);

  // THEN
  expect(event.id.value).toBe(storedInput.payload.id);
  expect(event.metadata.createdAt).toEqual(storedInput.metadata.createdAt);
  expect(event.metadata.updatedAt).toEqual(storedInput.metadata.updatedAt);
  expect(event.tenant.equals(tenant)).toBe(true);
  expect(String(event.external.toJSON().id)).toBe(external.id);
  expect(String(event.external.toJSON().provider)).toBe(external.provider);
  expect(event.graphId.value).toBe(graphId);
  expect(event.raw).toEqual(raw);
});

test("Event.restore: given an unsupported external provider, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    Event.restore({
      ...storedInput,
      payload: {
        ...storedInput.payload,
        external: {
          id: "jira-123",
          provider: "github",
        } as unknown as EventExternalPropsIn,
      },
    }),
  ).toThrow();
});
