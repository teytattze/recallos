import { test, expect } from "bun:test";

import { EventId } from "./event-id.value-object.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import { KnowledgeGraphNode } from "./knowledge-graph-node.aggregate.ts";

const now = new Date("2026-01-01T00:00:00Z");

const validInput = {
  graphId: KnowledgeGraphId.create(),
  type: "PERSON" as const,
  body: "Ada Lovelace",
  eventIds: [EventId.create()],
  now,
};

test("KnowledgeGraphNode.create: given valid input, it should return an ok node", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraphNode.create(validInput);

  // THEN
  expect(result.ok).toBe(true);
});

test("KnowledgeGraphNode.create: given valid input, it should stamp now as the created-at metadata", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraphNode.create(validInput);

  // THEN
  expect(result.ok && result.value.metadata.createdAt).toEqual(now);
});

test("KnowledgeGraphNode.create: given a fresh node, it should mint a distinct id each time", () => {
  // GIVEN / WHEN
  const a = KnowledgeGraphNode.create(validInput);
  const b = KnowledgeGraphNode.create(validInput);

  // THEN
  expect(a.ok && b.ok && a.value.id.value).not.toBe(
    b.ok ? b.value.id.value : "",
  );
});

test("KnowledgeGraphNode.create: given a blank body, it should return an InvalidKnowledgeGraphNode error", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraphNode.create({ ...validInput, body: "   " });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphNode");
  expect(result.error.category).toBe("validation");
});

test("KnowledgeGraphNode.create: given no source events, it should return an InvalidKnowledgeGraphNode error", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraphNode.create({ ...validInput, eventIds: [] });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphNode");
});

test("KnowledgeGraphNode.create: given only duplicate source events, it should still be allowed", () => {
  // GIVEN
  const eventId = EventId.create();

  // WHEN
  const result = KnowledgeGraphNode.create({
    ...validInput,
    eventIds: [eventId, eventId],
  });

  // THEN
  expect(result.ok).toBe(true);
});

const storedRow = {
  id: "01952d3f-0000-7000-8000-000000000001",
  graphId: "01952d3f-0000-7000-8000-000000000002",
  type: "PERSON" as const,
  body: "Ada Lovelace",
  eventIds: ["01952d3f-0000-7000-8000-000000000003"],
  embedding: null,
  createdAt: now,
  updatedAt: new Date("2026-01-03T00:00:00Z"),
};

test("KnowledgeGraphNode.restore: given a stored row, it should preserve the id and audit timestamps", () => {
  // GIVEN / WHEN
  const node = KnowledgeGraphNode.restore(storedRow);

  // THEN
  expect(node.id.value).toBe(storedRow.id);
  expect(node.metadata.createdAt).toEqual(storedRow.createdAt);
  expect(node.metadata.updatedAt).toEqual(storedRow.updatedAt);
});

test("KnowledgeGraphNode.restore: given a row with no source events, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    KnowledgeGraphNode.restore({ ...storedRow, eventIds: [] }),
  ).toThrow();
});
