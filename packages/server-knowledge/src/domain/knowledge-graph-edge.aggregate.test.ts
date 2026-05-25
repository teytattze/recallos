import { expect, test } from "bun:test";

import { Confidence } from "./confidence.value-object.ts";
import {
  EdgeId,
  EventId,
  KnowledgeGraphId,
  NodeId,
} from "./ids.value-object.ts";
import { KnowledgeGraphEdge } from "./knowledge-graph-edge.aggregate.ts";
import { RelationshipType } from "./relationship-type.value-object.ts";

const EARLIER = new Date("2026-03-01T00:00:00.000Z");
const NOW = new Date("2026-05-25T00:00:00.000Z");
const LATER = new Date("2026-06-01T00:00:00.000Z");

function confidence(value: number): Confidence {
  const result = Confidence.create(value);
  if (!result.ok) throw new Error("confidence setup failed");
  return result.value;
}

function makeEdge(
  fromId: NodeId,
  toId: NodeId,
  sourceEventIds: EventId[],
): KnowledgeGraphEdge {
  const result = KnowledgeGraphEdge.create({
    id: EdgeId.generate(),
    graphId: KnowledgeGraphId.generate(),
    fromId,
    toId,
    relationship: RelationshipType.RELATED_TO,
    confidence: confidence(0.8),
    sourceEventIds,
    observedAt: NOW,
    now: NOW,
  });
  if (!result.ok) throw new Error("edge setup failed");
  return result.value;
}

test("KnowledgeGraphEdge.create: given identical endpoints, it should fail with SelfLoopNotAllowedError", () => {
  const node = NodeId.generate();

  const result = KnowledgeGraphEdge.create({
    id: EdgeId.generate(),
    graphId: KnowledgeGraphId.generate(),
    fromId: node,
    toId: node,
    relationship: RelationshipType.RELATED_TO,
    confidence: confidence(0.9),
    sourceEventIds: [EventId.from("e1")],
    observedAt: NOW,
    now: NOW,
  });

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("SelfLoopNotAllowedError");
});

test("KnowledgeGraphEdge.create: given no source events, it should fail with MissingProvenanceError", () => {
  const result = KnowledgeGraphEdge.create({
    id: EdgeId.generate(),
    graphId: KnowledgeGraphId.generate(),
    fromId: NodeId.generate(),
    toId: NodeId.generate(),
    relationship: RelationshipType.RELATED_TO,
    confidence: confidence(0.9),
    sourceEventIds: [],
    observedAt: NOW,
    now: NOW,
  });

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("MissingProvenanceError");
});

test("KnowledgeGraphEdge.create: given valid props, it should record NodesRelated", () => {
  const edge = makeEdge(NodeId.generate(), NodeId.generate(), [
    EventId.from("e1"),
  ]);

  expect(edge.pullDomainEvents().map((event) => event.eventName)).toEqual([
    "NodesRelated",
  ]);
});

test("KnowledgeGraphEdge.reinforce: given a newer observation, it should advance observedAt, union provenance, and record EdgeReinforced", () => {
  const edge = makeEdge(NodeId.generate(), NodeId.generate(), [
    EventId.from("e1"),
  ]);
  edge.pullDomainEvents();

  edge.reinforce({
    confidence: confidence(0.95),
    sourceEventIds: [EventId.from("e2")],
    observedAt: LATER,
    now: NOW,
  });

  expect(edge.confidence.value).toBe(0.95);
  expect(edge.sourceEventIds).toHaveLength(2);
  expect(edge.observedAt).toEqual(LATER);
  expect(edge.pullDomainEvents().map((event) => event.eventName)).toEqual([
    "EdgeReinforced",
  ]);
});

test("KnowledgeGraphEdge.reinforce: given an older observation, it should keep the later observedAt", () => {
  const edge = makeEdge(NodeId.generate(), NodeId.generate(), [
    EventId.from("e1"),
  ]);

  edge.reinforce({
    confidence: confidence(0.95),
    sourceEventIds: [EventId.from("e1")],
    observedAt: EARLIER,
    now: NOW,
  });

  expect(edge.observedAt).toEqual(NOW);
  expect(edge.sourceEventIds).toHaveLength(1);
});
