import { test, expect } from "bun:test";
import { Tenant } from "@repo/server-kernel";

import { EventId } from "./event-id.value-object.ts";
import { KnowledgeGraphEdge } from "./knowledge-graph-edge.aggregate.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import { NodeId } from "./node-id.value-object.ts";

const now = new Date("2026-01-02T00:00:00Z");
const observedAt = new Date("2026-01-01T00:00:00Z");
const tenant = Tenant.organization("org1");

const validInput = {
  tenant,
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

test("KnowledgeGraphEdge.create: given valid input, it should preserve the tenant", () => {
  // GIVEN / WHEN
  const result = KnowledgeGraphEdge.create(validInput);

  // THEN
  expect(result.ok && result.value.tenant).toBe(tenant);
});

const sameNode = NodeId.create();

test.each([
  ["fromId equal to toId", { fromId: sameNode, toId: sameNode }],
  ["confidence above 1", { confidence: 1.5 }],
  ["confidence below 0", { confidence: -0.1 }],
  ["no source events", { sourceEventIds: [] }],
])(
  "KnowledgeGraphEdge.create: given %s, it should return an InvalidKnowledgeGraphEdge error",
  (_label, patch) => {
    // GIVEN / WHEN
    const result = KnowledgeGraphEdge.create({ ...validInput, ...patch });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidKnowledgeGraphEdge");
    expect(result.error.category).toBe("validation");
  },
);

const storedRow = {
  id: "01952d3f-0000-7000-8000-000000000010",
  tenantType: "organization" as const,
  tenantId: "org1",
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

test("KnowledgeGraphEdge.restore: given a stored row, it should restore the tenant", () => {
  // GIVEN / WHEN
  const edge = KnowledgeGraphEdge.restore(storedRow);

  // THEN
  expect(edge.tenant.equals(tenant)).toBe(true);
});

test("KnowledgeGraphEdge.restore: given a row with out-of-range confidence, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    KnowledgeGraphEdge.restore({ ...storedRow, confidence: 2 }),
  ).toThrow();
});

const createEdge = (): KnowledgeGraphEdge => {
  const result = KnowledgeGraphEdge.create(validInput);
  if (!result.ok) throw new Error("expected ok edge");
  return result.value;
};

test("KnowledgeGraphEdge.create: given a fresh edge, it should record a NodesRelated event", () => {
  // GIVEN
  const edge = createEdge();

  // WHEN
  const events = edge.pullDomainEvents();

  // THEN
  expect(events).toHaveLength(1);
  expect(events[0]?.eventName).toBe("NodesRelated");
  expect(events[0]?.aggregateId).toBe(edge.id.value);
});

test("KnowledgeGraphEdge.reinforce: given a later observation, it should union provenance and keep the latest observedAt", () => {
  // GIVEN
  const edge = createEdge();
  const laterObserved = new Date("2026-02-01T00:00:00Z");
  const reinforcedAt = new Date("2026-02-02T00:00:00Z");
  const freshEvent = EventId.create();

  // WHEN
  const result = edge.reinforce({
    confidence: 0.7,
    sourceEventIds: [freshEvent],
    observedAt: laterObserved,
    now: reinforcedAt,
  });

  // THEN
  expect(result.ok).toBe(true);
  expect(edge.sourceEventIds).toHaveLength(2);
  expect(edge.observedAt).toEqual(laterObserved);
  expect(edge.metadata.updatedAt).toEqual(reinforcedAt);
});

test("KnowledgeGraphEdge.reinforce: given an earlier observation, it should keep the existing observedAt", () => {
  // GIVEN
  const edge = createEdge();
  const earlier = new Date("2025-12-01T00:00:00Z");

  // WHEN
  edge.reinforce({
    confidence: 0.5,
    sourceEventIds: [EventId.create()],
    observedAt: earlier,
    now,
  });

  // THEN
  expect(edge.observedAt).toEqual(observedAt);
});

test("KnowledgeGraphEdge.reinforce: given out-of-range confidence, it should return an InvalidKnowledgeGraphEdge error", () => {
  // GIVEN
  const edge = createEdge();

  // WHEN
  const result = edge.reinforce({
    confidence: 1.5,
    sourceEventIds: [EventId.create()],
    observedAt,
    now,
  });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidKnowledgeGraphEdge");
});
