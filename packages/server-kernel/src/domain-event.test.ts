import { test, expect } from "bun:test";

import { defineEvent } from "./domain-event.ts";

test("defineEvent: given core fields and a payload, it should build a domain event", () => {
  // GIVEN
  const NodeCreated = defineEvent("NodeCreated")<{
    graphId: string;
    type: "PERSON";
  }>;
  const createdAt = new Date("2026-01-01T00:00:00Z");

  // WHEN
  const event = NodeCreated("node-1", createdAt, {
    graphId: "graph-1",
    type: "PERSON",
  });

  // THEN
  expect(event.eventName).toBe("NodeCreated");
  expect(event.aggregateId).toBe("node-1");
  expect(event.createdAt).toBe(createdAt);
  expect(event.graphId).toBe("graph-1");
  expect(event.type).toBe("PERSON");
});
