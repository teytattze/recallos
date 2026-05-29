import { test, expect } from "bun:test";

import { Embedding } from "./embedding.value-object.ts";
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

function unwrapNode(input = validInput): KnowledgeGraphNode {
  const result = KnowledgeGraphNode.create(input);
  if (!result.ok) throw new Error("expected an ok node");
  return result.value;
}

test("KnowledgeGraphNode.create: given a new node, it should record a NodeCreated event", () => {
  // GIVEN / WHEN
  const node = unwrapNode();
  const events = node.pullDomainEvents();

  // THEN
  expect(events).toHaveLength(1);
  expect(events[0]!.eventName).toBe("knowledge.NodeCreated");
});

test("KnowledgeGraphNode.attachEvents: given a new event, it should grow provenance and record NodeProvenanceExtended", () => {
  // GIVEN
  const node = unwrapNode();
  node.pullDomainEvents();
  const newEvent = EventId.create();

  // WHEN
  node.attachEvents([newEvent], new Date("2026-02-01T00:00:00Z"));

  // THEN
  expect(node.eventIds).toHaveLength(2);
  const events = node.pullDomainEvents();
  expect(events).toHaveLength(1);
  expect(events[0]!.eventName).toBe("knowledge.NodeProvenanceExtended");
});

test("KnowledgeGraphNode.attachEvents: given an already-known event, it should be a no-op", () => {
  // GIVEN
  const existing = validInput.eventIds[0]!;
  const node = unwrapNode();
  node.pullDomainEvents();

  // WHEN
  node.attachEvents([existing], new Date("2026-02-01T00:00:00Z"));

  // THEN
  expect(node.eventIds).toHaveLength(1);
  expect(node.pullDomainEvents()).toHaveLength(0);
});

test("KnowledgeGraphNode.assignEmbedding: given an embedding, it should store it and record NodeEmbedded", () => {
  // GIVEN
  const node = unwrapNode();
  node.pullDomainEvents();
  const embeddingResult = Embedding.create([0.1, 0.2, 0.3], "text-embed-3");
  if (!embeddingResult.ok) throw new Error("expected an ok embedding");

  // WHEN
  node.assignEmbedding(embeddingResult.value, new Date("2026-02-01T00:00:00Z"));

  // THEN
  expect(node.embedding?.model).toBe("text-embed-3");
  const events = node.pullDomainEvents();
  expect(events[0]!.eventName).toBe("knowledge.NodeEmbedded");
});
