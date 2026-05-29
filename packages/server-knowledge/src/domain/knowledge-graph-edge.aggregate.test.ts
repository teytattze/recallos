import { test, expect } from "bun:test";

import { EventId } from "./event-id.value-object.ts";
import { KnowledgeGraphEdge } from "./knowledge-graph-edge.aggregate.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import { NodeId } from "./node-id.value-object.ts";

const now = new Date("2026-01-02T00:00:00Z");
const observedAt = new Date("2026-01-01T00:00:00Z");

const validInput = {
  graphId: KnowledgeGraphId.create(),
  fromId: NodeId.create(),
  toId: NodeId.create(),
  relationship: "MENTIONS" as const,
  confidence: 0.9,
  sourceEventIds: [EventId.create()],
  observedAt,
  now,
};

test("KnowledgeGraphEdge.create: given valid input, it should return an ok edge", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraphEdge.create(validInput);

  // THEN
  expect(result.ok).toBe(true);
});

test("KnowledgeGraphEdge.create: given valid input, it should stamp now as the created-at metadata", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraphEdge.create(validInput);

  // THEN
  expect(result.ok && result.value.metadata.createdAt).toEqual(now);
});

test("KnowledgeGraphEdge.create: given fromId equal to toId, it should return an InvalidKnowledgeGraphEdge error", () => {
  // GIVEN
  const nodeId = NodeId.create();

  // WHEN
  const result = KnowledgeGraphEdge.create({
    ...validInput,
    fromId: nodeId,
    toId: nodeId,
  });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphEdge");
  expect(result.error.category).toBe("validation");
});

test("KnowledgeGraphEdge.create: given confidence above 1, it should return an InvalidKnowledgeGraphEdge error", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraphEdge.create({ ...validInput, confidence: 1.5 });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphEdge");
});

test("KnowledgeGraphEdge.create: given confidence below 0, it should return an InvalidKnowledgeGraphEdge error", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraphEdge.create({ ...validInput, confidence: -0.1 });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphEdge");
});

test("KnowledgeGraphEdge.create: given no source events, it should return an InvalidKnowledgeGraphEdge error", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraphEdge.create({
    ...validInput,
    sourceEventIds: [],
  });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphEdge");
});

const storedRow = {
  id: "01952d3f-0000-7000-8000-000000000010",
  graphId: "01952d3f-0000-7000-8000-000000000011",
  fromId: "01952d3f-0000-7000-8000-000000000012",
  toId: "01952d3f-0000-7000-8000-000000000013",
  relationship: "MENTIONS" as const,
  confidence: 0.9,
  sourceEventIds: ["01952d3f-0000-7000-8000-000000000014"],
  observedAt,
  createdAt: now,
  updatedAt: new Date("2026-01-03T00:00:00Z"),
};

test("KnowledgeGraphEdge.restore: given a stored row, it should preserve the id and audit timestamps", () => {
  // GIVEN / WHEN
  const edge = KnowledgeGraphEdge.restore(storedRow);

  // THEN
  expect(edge.id.value).toBe(storedRow.id);
  expect(edge.metadata.createdAt).toEqual(storedRow.createdAt);
  expect(edge.metadata.updatedAt).toEqual(storedRow.updatedAt);
});

test("KnowledgeGraphEdge.restore: given a row with out-of-range confidence, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    KnowledgeGraphEdge.restore({ ...storedRow, confidence: 2 }),
  ).toThrow();
});

function unwrapEdge(): KnowledgeGraphEdge {
  const result = KnowledgeGraphEdge.create(validInput);
  if (!result.ok) throw new Error("expected an ok edge");
  return result.value;
}

test("KnowledgeGraphEdge.create: given a new edge, it should record a NodesRelated event", () => {
  // GIVEN / WHEN
  const edge = unwrapEdge();
  const events = edge.pullDomainEvents();

  // THEN
  expect(events).toHaveLength(1);
  expect(events[0]!.eventName).toBe("knowledge.NodesRelated");
});

test("KnowledgeGraphEdge.reinforce: given a later observation, it should accumulate provenance and keep the latest observedAt", () => {
  // GIVEN
  const edge = unwrapEdge();
  edge.pullDomainEvents();
  const laterObserved = new Date("2026-03-01T00:00:00Z");

  // WHEN
  const result = edge.reinforce({
    confidence: 0.7,
    sourceEventIds: [EventId.create()],
    observedAt: laterObserved,
    now,
  });

  // THEN
  expect(result.ok).toBe(true);
  expect(edge.sourceEventIds).toHaveLength(2);
  expect(edge.observedAt).toEqual(laterObserved);
  const events = edge.pullDomainEvents();
  expect(events[0]!.eventName).toBe("knowledge.EdgeReinforced");
});

test("KnowledgeGraphEdge.reinforce: given an earlier observation, it should keep the existing observedAt", () => {
  // GIVEN
  const edge = unwrapEdge();

  // WHEN
  edge.reinforce({
    confidence: 0.7,
    sourceEventIds: [EventId.create()],
    observedAt: new Date("2025-01-01T00:00:00Z"),
    now,
  });

  // THEN
  expect(edge.observedAt).toEqual(observedAt);
});

test("KnowledgeGraphEdge.reinforce: given out-of-range confidence, it should return an error", () => {
  // GIVEN
  const edge = unwrapEdge();

  // WHEN
  const result = edge.reinforce({
    confidence: 2,
    sourceEventIds: [EventId.create()],
    observedAt,
    now,
  });

  // THEN
  expect(result.ok).toBe(false);
});
