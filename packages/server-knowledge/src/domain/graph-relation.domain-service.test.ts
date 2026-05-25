import { expect, test } from "bun:test";

import { Confidence } from "./confidence.value-object.ts";
import { GraphRelation } from "./graph-relation.domain-service.ts";
import {
  EdgeId,
  EventId,
  KnowledgeGraphId,
  NodeId,
} from "./ids.value-object.ts";
import { KnowledgeGraphEdge } from "./knowledge-graph-edge.aggregate.ts";
import { KnowledgeGraphNode } from "./knowledge-graph-node.aggregate.ts";
import { NodeBody } from "./node-body.value-object.ts";
import { NodeType } from "./node-type.value-object.ts";
import { RelationshipType } from "./relationship-type.value-object.ts";

const NOW = new Date("2026-05-25T00:00:00.000Z");
const GRAPH_ID = KnowledgeGraphId.generate();

function confidence(value: number): Confidence {
  const result = Confidence.create(value);
  if (!result.ok) throw new Error("confidence setup failed");
  return result.value;
}

function node(type: NodeType): KnowledgeGraphNode {
  const bodyResult = NodeBody.create(`a ${type}`);
  if (!bodyResult.ok) throw new Error("body setup failed");
  const result = KnowledgeGraphNode.create({
    id: NodeId.generate(),
    graphId: GRAPH_ID,
    type,
    body: bodyResult.value,
    eventIds: [EventId.from("e1")],
    now: NOW,
  });
  if (!result.ok) throw new Error("node setup failed");
  return result.value;
}

test("GraphRelation.relate: given compatible types and no existing edge, it should create a new edge", () => {
  const result = GraphRelation.relate({
    from: node(NodeType.DOCUMENT),
    to: node(NodeType.PERSON),
    relationship: RelationshipType.AUTHORED_BY,
    confidence: confidence(0.9),
    sourceEventIds: [EventId.from("e1")],
    observedAt: NOW,
    newEdgeId: EdgeId.generate(),
    existing: null,
    now: NOW,
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.relationship).toBe(RelationshipType.AUTHORED_BY);
});

test("GraphRelation.relate: given incompatible endpoint types, it should fail with IncompatibleRelationshipError", () => {
  const result = GraphRelation.relate({
    from: node(NodeType.PERSON),
    to: node(NodeType.PERSON),
    relationship: RelationshipType.AUTHORED_BY,
    confidence: confidence(0.9),
    sourceEventIds: [EventId.from("e1")],
    observedAt: NOW,
    newEdgeId: EdgeId.generate(),
    existing: null,
    now: NOW,
  });

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("IncompatibleRelationshipError");
});

test("GraphRelation.relate: given the same node on both ends, it should fail with SelfLoopNotAllowedError", () => {
  const only = node(NodeType.PERSON);

  const result = GraphRelation.relate({
    from: only,
    to: only,
    relationship: RelationshipType.RELATED_TO,
    confidence: confidence(0.9),
    sourceEventIds: [EventId.from("e1")],
    observedAt: NOW,
    newEdgeId: EdgeId.generate(),
    existing: null,
    now: NOW,
  });

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("SelfLoopNotAllowedError");
});

test("GraphRelation.relate: given an existing edge, it should reinforce it instead of creating a new one", () => {
  const from = node(NodeType.DOCUMENT);
  const to = node(NodeType.PERSON);
  const existingResult = KnowledgeGraphEdge.create({
    id: EdgeId.generate(),
    graphId: GRAPH_ID,
    fromId: from.id,
    toId: to.id,
    relationship: RelationshipType.AUTHORED_BY,
    confidence: confidence(0.5),
    sourceEventIds: [EventId.from("e1")],
    observedAt: NOW,
    now: NOW,
  });
  if (!existingResult.ok) throw new Error("existing edge setup failed");
  const existing = existingResult.value;

  const result = GraphRelation.relate({
    from,
    to,
    relationship: RelationshipType.AUTHORED_BY,
    confidence: confidence(0.99),
    sourceEventIds: [EventId.from("e2")],
    observedAt: NOW,
    newEdgeId: EdgeId.generate(),
    existing,
    now: NOW,
  });

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.id.equals(existing.id)).toBe(true);
  expect(result.value.confidence.value).toBe(0.99);
  expect(result.value.sourceEventIds).toHaveLength(2);
});
