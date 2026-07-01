import type { JsonObject } from "type-fest";

import { AppError } from "@repo/app-error";
import { test, expect } from "bun:test";

import type { EventExternalPropsIn } from "../value-objects/event-external.ts";

import { Event } from "./event.ts";

const createdAt = new Date("2026-01-02T00:00:00Z");
const updatedAt = new Date("2026-01-03T00:00:00Z");
const tenant = "organization:org1";
const metadata = { now: createdAt };
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
  // GIVEN
  const input = validInput;

  // WHEN
  const event = Event.create(input);

  // THEN
  expect(event.metadata.createdAt).toEqual(createdAt);
  expect(event.tenant.toString()).toBe(tenant);
  expect(String(event.external.toJSON().id)).toBe(external.id);
  expect(String(event.external.toJSON().provider)).toBe(external.provider);
  expect(event.graphId.value).toBe(graphId);
  expect(event.raw).toEqual(raw);
});

test("Event.create: given a fresh event, it should mint a distinct id each time", () => {
  // GIVEN
  const input = validInput;

  // WHEN
  const a = Event.create(input);
  const b = Event.create(input);

  // THEN
  expect(a.id.value).not.toBe(b.id.value);
});

test("Event.estimatedSizeInBytes: given an event, it should return a positive size", () => {
  // GIVEN
  const event = Event.create(validInput);

  // WHEN
  const size = event.estimatedSizeInBytes();

  // THEN
  expect(size).toBeGreaterThan(0);
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
  "Event.create: given $label, it should throw an InvariantViolation app error",
  ({ payload }) => {
    // GIVEN
    const input = {
      ...validInput,
      payload,
    };

    // WHEN
    let error: unknown;
    try {
      Event.create(input);
    } catch (caught) {
      error = caught;
    }

    // THEN
    expect(error).toBeInstanceOf(AppError);
    expect(AppError.from(error).code).toBe("serverKernel.invariantViolation");
  },
);

const storedInput = {
  tenant,
  metadata: { createdAt, updatedAt },
  payload: {
    id: "01952d3f-0000-7000-8000-000000000000",
    external,
    graphId,
    raw,
  },
};

test("Event.restore: given a stored row, it should preserve persisted identity and ownership", () => {
  // GIVEN
  const input = storedInput;

  // WHEN
  const event = Event.restore(input);

  // THEN
  expect(event.id.value).toBe(storedInput.payload.id);
  expect(event.metadata.createdAt).toEqual(storedInput.metadata.createdAt);
  expect(event.metadata.updatedAt).toEqual(storedInput.metadata.updatedAt);
  expect(event.tenant.toString()).toBe(tenant);
  expect(String(event.external.toJSON().id)).toBe(external.id);
  expect(String(event.external.toJSON().provider)).toBe(external.provider);
  expect(event.graphId.value).toBe(graphId);
  expect(event.raw).toEqual(raw);
});

test("Event.restore: given an unsupported external provider, it should throw an InvariantViolation app error", () => {
  // GIVEN / WHEN
  let error: unknown;
  try {
    Event.restore({
      ...storedInput,
      payload: {
        ...storedInput.payload,
        external: {
          id: "jira-123",
          provider: "github",
        } as unknown as EventExternalPropsIn,
      },
    });
  } catch (caught) {
    error = caught;
  }

  // THEN
  expect(error).toBeInstanceOf(AppError);
  expect(AppError.from(error).code).toBe("serverKernel.invariantViolation");
});
