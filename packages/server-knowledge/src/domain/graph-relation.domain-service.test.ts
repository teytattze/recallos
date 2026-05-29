import { expect, test } from "bun:test";

import { EventId } from "./event-id.value-object.ts";
import { GraphRelation } from "./graph-relation.domain-service.ts";
import { KnowledgeGraphEdge } from "./knowledge-graph-edge.aggregate.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import { KnowledgeGraphNode } from "./knowledge-graph-node.aggregate.ts";

const now = new Date("2026-01-02T00:00:00Z");
const observedAt = new Date("2026-01-01T00:00:00Z");
const graphId = KnowledgeGraphId.create();

function makeNode(): KnowledgeGraphNode {
  const result = KnowledgeGraphNode.create({
    graphId,
    type: "PERSON",
    body: "Ada Lovelace",
    eventIds: [EventId.create()],
    now,
  });
  if (!result.ok) throw new Error("failed to make node");
  return result.value;
}

test("GraphRelation.relate: given no existing edge, it should create a new edge", () => {
  // GIVEN
  const from = makeNode();
  const to = makeNode();

  // WHEN
  const result = GraphRelation.relate({
    from,
    to,
    relationship: "MENTIONS",
    confidence: 0.8,
    sourceEventIds: [EventId.create()],
    observedAt,
    existing: null,
    now,
  });

  // THEN
  expect(result.ok).toBe(true);
  expect(result.ok && result.value.fromId.equals(from.id)).toBe(true);
  expect(result.ok && result.value.toId.equals(to.id)).toBe(true);
});

test("GraphRelation.relate: given the same from and to, it should fail with a self-loop error", () => {
  // GIVEN
  const node = makeNode();

  // WHEN
  const result = GraphRelation.relate({
    from: node,
    to: node,
    relationship: "MENTIONS",
    confidence: 0.8,
    sourceEventIds: [EventId.create()],
    observedAt,
    existing: null,
    now,
  });

  // THEN
  expect(result.ok).toBe(false);
});

test("GraphRelation.relate: given an existing edge, it should reinforce it and accumulate provenance", () => {
  // GIVEN
  const from = makeNode();
  const to = makeNode();
  const firstEvent = EventId.create();
  const created = KnowledgeGraphEdge.create({
    graphId,
    fromId: from.id,
    toId: to.id,
    relationship: "MENTIONS",
    confidence: 0.5,
    sourceEventIds: [firstEvent],
    observedAt,
    now,
  });
  if (!created.ok) throw new Error("failed to make edge");
  const existing = created.value;
  const secondEvent = EventId.create();

  // WHEN
  const result = GraphRelation.relate({
    from,
    to,
    relationship: "MENTIONS",
    confidence: 0.9,
    sourceEventIds: [secondEvent],
    observedAt: new Date("2026-02-01T00:00:00Z"),
    existing,
    now,
  });

  // THEN
  expect(result.ok && result.value).toBe(existing);
  expect(result.ok && result.value.sourceEventIds.length).toBe(2);
  expect(result.ok && result.value.confidence.equals(existing.confidence)).toBe(
    true,
  );
  expect(result.ok && result.value.observedAt).toEqual(
    new Date("2026-02-01T00:00:00Z"),
  );
});
