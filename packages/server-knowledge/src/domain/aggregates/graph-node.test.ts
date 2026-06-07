import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { test, expect } from "bun:test";

import { Embedding } from "../value-objects/embedding.ts";
import { EventId } from "../value-objects/event-id.ts";
import { GraphId } from "../value-objects/graph-id.ts";
import { GraphNodeBody } from "../value-objects/graph-node-body.ts";
import { GraphNode } from "./graph-node.ts";

const now = new Date("2026-01-01T00:00:00Z");
const later = new Date("2026-01-05T00:00:00Z");
const tenant = Tenant.create("organization", "org1");
const metadata = EntityMetadata.create(now);

const validInput = {
  tenant,
  metadata,
  payload: {
    graphId: GraphId.create(),
    body: "Ada Lovelace",
    eventIds: [EventId.create()],
  },
};

const createNode = (
  patch: Partial<typeof validInput.payload> = {},
): GraphNode => {
  const result = GraphNode.create({
    ...validInput,
    payload: { ...validInput.payload, ...patch },
  });
  if (!result.ok) throw new Error("expected ok node");
  return result.value;
};

test("GraphNode.create: given valid input, it should return an ok node", () => {
  // GIVEN / WHEN
  const result = GraphNode.create(validInput);

  // THEN
  expect(result.ok).toBe(true);
});

test("GraphNode.create: given valid input, it should stamp now as the created-at metadata", () => {
  // GIVEN / WHEN
  const result = GraphNode.create(validInput);

  // THEN
  expect(result.ok && result.value.metadata.createdAt).toEqual(now);
});

test("GraphNode.create: given valid input, it should preserve the tenant", () => {
  // GIVEN / WHEN
  const result = GraphNode.create(validInput);

  // THEN
  expect(result.ok && result.value.tenant).toBe(tenant);
});

test("GraphNode.create: given a fresh node, it should mint a distinct id each time", () => {
  // GIVEN / WHEN
  const a = GraphNode.create(validInput);
  const b = GraphNode.create(validInput);

  // THEN
  expect(a.ok && b.ok && a.value.id.value).not.toBe(
    b.ok ? b.value.id.value : "",
  );
});

test.each([
  ["a blank body", { body: "   " }],
  ["no source events", { eventIds: [] }],
])(
  "GraphNode.create: given %s, it should return an InvalidGraphNode error",
  (_label, patch) => {
    // GIVEN / WHEN
    const result = GraphNode.create({
      ...validInput,
      payload: { ...validInput.payload, ...patch },
    });

    // THEN
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("InvalidGraphNode");
    expect(result.error.category).toBe("validation");
  },
);

test("GraphNode.create: given only duplicate source events, it should still be allowed", () => {
  // GIVEN
  const eventId = EventId.create();

  // WHEN
  const result = GraphNode.create({
    ...validInput,
    payload: { ...validInput.payload, eventIds: [eventId, eventId] },
  });

  // THEN
  expect(result.ok).toBe(true);
});

const storedRow = {
  tenant,
  metadata: EntityMetadata.restore(now, new Date("2026-01-03T00:00:00Z")),
  payload: {
    id: "01952d3f-0000-7000-8000-000000000001",
    graphId: "01952d3f-0000-7000-8000-000000000002",
    body: "Ada Lovelace",
    eventIds: ["01952d3f-0000-7000-8000-000000000003"],
    embedding: null,
  },
};

test("GraphNode.restore: given a stored row, it should preserve the id and audit timestamps", () => {
  // GIVEN / WHEN
  const node = GraphNode.restore(storedRow);

  // THEN
  expect(node.id.value).toBe(storedRow.payload.id);
  expect(node.metadata.createdAt).toEqual(storedRow.metadata.createdAt);
  expect(node.metadata.updatedAt).toEqual(storedRow.metadata.updatedAt);
});

test("GraphNode.restore: given a stored row, it should restore the tenant", () => {
  // GIVEN / WHEN
  const node = GraphNode.restore(storedRow);

  // THEN
  expect(node.tenant.equals(tenant)).toBe(true);
});

test("GraphNode.restore: given a row with no source events, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    GraphNode.restore({
      ...storedRow,
      payload: { ...storedRow.payload, eventIds: [] },
    }),
  ).toThrow();
});

test("GraphNode.create: given a fresh node, it should record a NodeCreated event", () => {
  // GIVEN
  const node = createNode();

  // WHEN
  const events = node.pullDomainEvents();

  // THEN
  expect(events).toHaveLength(1);
  expect(events[0]?.eventName).toBe("NodeCreated");
  expect(events[0]?.aggregateId).toBe(node.id.value);
});

test("GraphNode.attachEvents: given a new event, it should union it into the provenance", () => {
  // GIVEN
  const node = createNode();
  const fresh = EventId.create();

  // WHEN
  node.attachEvents([fresh], later);

  // THEN
  expect(node.eventIds).toHaveLength(2);
  expect(node.metadata.updatedAt).toEqual(later);
});

test("GraphNode.attachEvents: given an already-attached event, it should be an idempotent no-op", () => {
  // GIVEN
  const node = createNode();
  const existing = node.eventIds[0]!;

  // WHEN
  node.attachEvents([EventId.restore({ payload: existing.value })], later);

  // THEN
  expect(node.eventIds).toHaveLength(1);
  expect(node.metadata.updatedAt).toEqual(now);
});

test("GraphNode.assignEmbedding: given a node born without one, it should flip embedding from null", () => {
  // GIVEN
  const node = createNode();
  node.pullDomainEvents();
  const embeddingResult = Embedding.create({
    payload: {
      vector: [0.1, 0.2, 0.3],
      model: "text-embedding-3-small",
    },
  });
  if (!embeddingResult.ok) throw new Error("expected ok embedding");

  // WHEN
  node.assignEmbedding(embeddingResult.value, later);

  // THEN
  expect(node.embedding).not.toBeNull();
  expect(node.metadata.updatedAt).toEqual(later);
  const events = node.pullDomainEvents();
  expect(events[0]?.eventName).toBe("NodeEmbedded");
});

test("GraphNode.reviseBody: given new text, it should replace the body", () => {
  // GIVEN
  const node = createNode();

  // WHEN
  const result = node.reviseBody("Augusta Ada King", later);

  // THEN
  expect(result.ok).toBe(true);
  expect(
    node.body.equals(GraphNodeBody.restore({ payload: "Augusta Ada King" })),
  ).toBe(true);
  expect(node.metadata.updatedAt).toEqual(later);
});

test("GraphNode.reviseBody: given a blank body, it should return an InvalidGraphNode error", () => {
  // GIVEN
  const node = createNode();

  // WHEN
  const result = node.reviseBody("   ", later);

  // THEN
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("InvalidGraphNode");
});

test("GraphNode.absorb: given a duplicate, the survivor should gain the duplicate's eventIds", () => {
  // GIVEN
  const survivor = createNode({ eventIds: [EventId.create()] });
  const duplicate = createNode({ eventIds: [EventId.create()] });

  // WHEN
  survivor.absorb(duplicate, later);

  // THEN
  expect(survivor.eventIds).toHaveLength(2);
});

test("GraphNode.absorb: given the same duplicate twice, the second absorb should be a no-op", () => {
  // GIVEN
  const survivor = createNode({ eventIds: [EventId.create()] });
  const duplicate = createNode({ eventIds: [EventId.create()] });
  survivor.absorb(duplicate, later);

  // WHEN
  survivor.absorb(duplicate, later);

  // THEN
  expect(survivor.eventIds).toHaveLength(2);
});
