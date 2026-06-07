import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { test, expect } from "bun:test";

import { EventId } from "../value-objects/event-id.ts";
import { GraphId } from "../value-objects/graph-id.ts";
import { GraphNodeId } from "../value-objects/graph-node-id.ts";
import { GraphEdge } from "./graph-edge.ts";

const now = new Date("2026-01-02T00:00:00Z");
const tenant = Tenant.create("organization", "org1");
const metadata = EntityMetadata.create(now);

const validInput = {
  tenant,
  metadata,
  payload: {
    graphId: GraphId.create(),
    fromId: GraphNodeId.create(),
    toId: GraphNodeId.create(),
    relationship: "MENTIONS" as const,
    confidence: 0.9,
    sourceEventIds: [EventId.create()],
  },
};

test("GraphEdge.create: given valid input, it should return an edge with metadata and tenant", () => {
  // GIVEN / WHEN
  const result = GraphEdge.create(validInput);

  // THEN
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.metadata.createdAt).toEqual(now);
  expect(result.value.tenant).toBe(tenant);
});

const sameNode = GraphNodeId.create();

test.each([
  ["fromId equal to toId", { fromId: sameNode, toId: sameNode }],
  ["confidence above 1", { confidence: 1.5 }],
  ["confidence below 0", { confidence: -0.1 }],
  ["no source events", { sourceEventIds: [] }],
])(
  "GraphEdge.create: given %s, it should return an InvalidGraphEdge error",
  (_label, patch) => {
    // GIVEN / WHEN
    const result = GraphEdge.create({
      ...validInput,
      payload: { ...validInput.payload, ...patch },
    });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidGraphEdge");
    expect(result.error.category).toBe("validation");
  },
);

const storedRow = {
  tenant,
  metadata: EntityMetadata.restore(now, new Date("2026-01-03T00:00:00Z")),
  payload: {
    id: "01952d3f-0000-7000-8000-000000000010",
    graphId: "01952d3f-0000-7000-8000-000000000011",
    fromId: "01952d3f-0000-7000-8000-000000000012",
    toId: "01952d3f-0000-7000-8000-000000000013",
    relationship: "MENTIONS" as const,
    confidence: 0.9,
    sourceEventIds: ["01952d3f-0000-7000-8000-000000000014"],
  },
};

test("GraphEdge.restore: given a stored row, it should preserve persisted identity and tenant", () => {
  // GIVEN / WHEN
  const edge = GraphEdge.restore(storedRow);

  // THEN
  expect(edge.id.value).toBe(storedRow.payload.id);
  expect(edge.metadata.createdAt).toEqual(storedRow.metadata.createdAt);
  expect(edge.metadata.updatedAt).toEqual(storedRow.metadata.updatedAt);
  expect(edge.tenant.equals(tenant)).toBe(true);
});

test("GraphEdge.restore: given a row with out-of-range confidence, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    GraphEdge.restore({
      ...storedRow,
      payload: { ...storedRow.payload, confidence: 2 },
    }),
  ).toThrow();
});

const createEdge = (): GraphEdge => {
  const result = GraphEdge.create(validInput);
  if (!result.ok) throw new Error("expected ok edge");
  return result.value;
};

test("GraphEdge.create: given a fresh edge, it should record a NodesRelated event", () => {
  // GIVEN
  const edge = createEdge();

  // WHEN
  const events = edge.pullDomainEvents();

  // THEN
  expect(events).toHaveLength(1);
  expect(events[0]?.eventName).toBe("NodesRelated");
  expect(events[0]?.aggregateId).toBe(edge.id.value);
});

test("GraphEdge.reinforce: given a new source event, it should union provenance and update audit metadata", () => {
  // GIVEN
  const edge = createEdge();
  const reinforcedAt = new Date("2026-02-02T00:00:00Z");
  const freshEvent = EventId.create();

  // WHEN
  const result = edge.reinforce({
    confidence: 0.7,
    sourceEventIds: [freshEvent],
    now: reinforcedAt,
  });

  // THEN
  expect(result.ok).toBe(true);
  expect(edge.sourceEventIds).toHaveLength(2);
  expect(edge.metadata.updatedAt).toEqual(reinforcedAt);
});

test("GraphEdge.reinforce: given an existing source event, it should keep provenance idempotent", () => {
  // GIVEN
  const edge = createEdge();
  const existing = edge.sourceEventIds[0]!;

  // WHEN
  edge.reinforce({
    confidence: 0.5,
    sourceEventIds: [EventId.restore({ payload: existing.value })],
    now,
  });

  // THEN
  expect(edge.sourceEventIds).toHaveLength(1);
});

test("GraphEdge.reinforce: given out-of-range confidence, it should return an InvalidGraphEdge error", () => {
  // GIVEN
  const edge = createEdge();

  // WHEN
  const result = edge.reinforce({
    confidence: 1.5,
    sourceEventIds: [EventId.create()],
    now,
  });

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidGraphEdge");
});
