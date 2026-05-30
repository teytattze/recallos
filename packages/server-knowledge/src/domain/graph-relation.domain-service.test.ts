import { test, expect } from "bun:test";

import { EventId } from "./event-id.value-object.ts";
import { GraphRelation, type RelateInput } from "./graph-relation.domain-service.ts";
import { KnowledgeGraphEdge } from "./knowledge-graph-edge.aggregate.ts";
import { KnowledgeGraphId } from "./knowledge-graph-id.value-object.ts";
import { NodeId } from "./node-id.value-object.ts";

const graphId = KnowledgeGraphId.create();
const fromId = NodeId.create();
const toId = NodeId.create();
const observedAt = new Date("2026-01-01T00:00:00Z");
const now = new Date("2026-01-02T00:00:00Z");

const baseInput: Omit<RelateInput, "existing"> = {
  graphId,
  fromId,
  toId,
  relationship: "MENTIONS",
  confidence: 0.9,
  sourceEventIds: [EventId.create()],
  observedAt,
  now,
};

const existingEdge = (): KnowledgeGraphEdge => {
  const result = KnowledgeGraphEdge.create(baseInput);
  if (!result.ok) throw new Error("expected ok edge");
  return result.value;
};

test("GraphRelation.relate: given no existing edge, it should create a brand-new edge", () => {
  // GIVEN / WHEN
  const result = GraphRelation.relate({ ...baseInput, existing: null });

  // THEN
  expect(result.ok).toBe(true);
  expect(result.ok && result.value.fromId.equals(fromId)).toBe(true);
});

test("GraphRelation.relate: given an existing edge, it should reinforce that same edge instead of duplicating", () => {
  // GIVEN
  const existing = existingEdge();
  const fresh = EventId.create();
  const laterObserved = new Date("2026-03-01T00:00:00Z");

  // WHEN
  const result = GraphRelation.relate({
    ...baseInput,
    sourceEventIds: [fresh],
    observedAt: laterObserved,
    existing,
  });

  // THEN
  expect(result.ok && result.value).toBe(existing);
  expect(existing.sourceEventIds).toHaveLength(2);
  expect(existing.observedAt).toEqual(laterObserved);
});
