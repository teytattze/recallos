import { test, expect } from "bun:test";

import { defineEvent } from "./domain-event.ts";

test("defineEvent: given an event name, it should build events with that eventName", () => {
  // GIVEN
  const NodeCreated = defineEvent("NodeCreated");

  // WHEN
  const event = NodeCreated("node-1", new Date("2026-01-01T00:00:00Z"));

  // THEN
  expect(event.eventName).toBe("NodeCreated");
});

test("defineEvent: given aggregate id and createdAt, it should preserve the core event fields", () => {
  // GIVEN
  const NodeCreated = defineEvent("NodeCreated");
  const createdAt = new Date("2026-01-01T00:00:00Z");

  // WHEN
  const event = NodeCreated("node-1", createdAt);

  // THEN
  expect(event.aggregateId).toBe("node-1");
  expect(event.createdAt).toBe(createdAt);
});

test("defineEvent: given a payload, it should merge payload fields onto the event", () => {
  // GIVEN
  const NodeCreated = defineEvent("NodeCreated")<{
    graphId: string;
    type: "PERSON";
  }>;

  // WHEN
  const event = NodeCreated("node-1", new Date("2026-01-01T00:00:00Z"), {
    graphId: "graph-1",
    type: "PERSON",
  });

  // THEN
  expect(event.graphId).toBe("graph-1");
  expect(event.type).toBe("PERSON");
});
