import { test, expect } from "bun:test";

import { Embedding } from "./embedding.value-object.ts";
import { EventId } from "./event-id.value-object.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import { KnowledgeGraphNode } from "./knowledge-graph-node.aggregate.ts";
import { NodeBody } from "./node-body.value-object.ts";

const now = new Date("2026-01-01T00:00:00Z");
const later = new Date("2026-01-05T00:00:00Z");

const validInput = {
  graphId: KnowledgeGraphId.create(),
  type: "PERSON" as const,
  body: "Ada Lovelace",
  eventIds: [EventId.create()],
  now,
};

const createNode = (
  patch: Partial<typeof validInput> = {},
): KnowledgeGraphNode => {
  const result = KnowledgeGraphNode.create({ ...validInput, ...patch });
  if (!result.ok) throw new Error("expected ok node");
  return result.value;
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

test.each([
  ["a blank body", { body: "   " }],
  ["no source events", { eventIds: [] }],
])(
  "KnowledgeGraphNode.create: given %s, it should return an InvalidKnowledgeGraphNode error",
  (_label, patch) => {
    // GIVEN / WHEN
    const result = KnowledgeGraphNode.create({ ...validInput, ...patch });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidKnowledgeGraphNode");
    expect(result.error.category).toBe("validation");
  },
);

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

test("KnowledgeGraphNode.create: given a fresh node, it should record a NodeCreated event", () => {
  // GIVEN
  const node = createNode();

  // WHEN
  const events = node.pullDomainEvents();

  // THEN
  expect(events).toHaveLength(1);
  expect(events[0]?.eventName).toBe("NodeCreated");
  expect(events[0]?.aggregateId).toBe(node.id.value);
});

test("KnowledgeGraphNode.attachEvents: given a new event, it should union it into the provenance", () => {
  // GIVEN
  const node = createNode();
  const fresh = EventId.create();

  // WHEN
  node.attachEvents([fresh], later);

  // THEN
  expect(node.eventIds).toHaveLength(2);
  expect(node.metadata.updatedAt).toEqual(later);
});

test("KnowledgeGraphNode.attachEvents: given an already-attached event, it should be an idempotent no-op", () => {
  // GIVEN
  const node = createNode();
  const existing = node.eventIds[0]!;

  // WHEN
  node.attachEvents([EventId.restore(existing.value)], later);

  // THEN
  expect(node.eventIds).toHaveLength(1);
  expect(node.metadata.updatedAt).toEqual(now);
});

test("KnowledgeGraphNode.assignEmbedding: given a node born without one, it should flip embedding from null", () => {
  // GIVEN
  const node = createNode();
  node.pullDomainEvents();
  const embeddingResult = Embedding.create([0.1, 0.2, 0.3], "text-embedding-3-small");
  if (!embeddingResult.ok) throw new Error("expected ok embedding");

  // WHEN
  node.assignEmbedding(embeddingResult.value, later);

  // THEN
  expect(node.embedding).not.toBeNull();
  expect(node.metadata.updatedAt).toEqual(later);
  const events = node.pullDomainEvents();
  expect(events[0]?.eventName).toBe("NodeEmbedded");
});

test("KnowledgeGraphNode.reviseBody: given new text, it should replace the body", () => {
  // GIVEN
  const node = createNode();

  // WHEN
  const result = node.reviseBody("Augusta Ada King", later);

  // THEN
  expect(result.ok).toBe(true);
  expect(node.body.equals(NodeBody.restore("Augusta Ada King"))).toBe(true);
  expect(node.metadata.updatedAt).toEqual(later);
});

test("KnowledgeGraphNode.reviseBody: given a blank body, it should return an InvalidKnowledgeGraphNode error", () => {
  // GIVEN
  const node = createNode();

  // WHEN
  const result = node.reviseBody("   ", later);

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphNode");
});

test("KnowledgeGraphNode.absorb: given a duplicate, the survivor should gain the duplicate's eventIds", () => {
  // GIVEN
  const survivor = createNode({ eventIds: [EventId.create()] });
  const duplicate = createNode({ eventIds: [EventId.create()] });

  // WHEN
  survivor.absorb(duplicate, later);

  // THEN
  expect(survivor.eventIds).toHaveLength(2);
});

test("KnowledgeGraphNode.absorb: given the same duplicate twice, the second absorb should be a no-op", () => {
  // GIVEN
  const survivor = createNode({ eventIds: [EventId.create()] });
  const duplicate = createNode({ eventIds: [EventId.create()] });
  survivor.absorb(duplicate, later);

  // WHEN
  survivor.absorb(duplicate, later);

  // THEN
  expect(survivor.eventIds).toHaveLength(2);
});
