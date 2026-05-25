import { expect, test } from "bun:test";

import { Embedding } from "./embedding.value-object.ts";
import { EventId, KnowledgeGraphId, NodeId } from "./ids.value-object.ts";
import { KnowledgeGraphNode } from "./knowledge-graph-node.aggregate.ts";
import { NodeBody } from "./node-body.value-object.ts";
import { NodeType } from "./node-type.value-object.ts";

const NOW = new Date("2026-05-25T00:00:00.000Z");

function body(text = "Alice"): NodeBody {
  const result = NodeBody.create(text);
  if (!result.ok) throw new Error("body setup failed");
  return result.value;
}

function makeNode(eventIds: EventId[]): KnowledgeGraphNode {
  const result = KnowledgeGraphNode.create({
    id: NodeId.generate(),
    graphId: KnowledgeGraphId.generate(),
    type: NodeType.PERSON,
    body: body(),
    eventIds,
    now: NOW,
  });
  if (!result.ok) throw new Error("node setup failed");
  return result.value;
}

test("KnowledgeGraphNode.create: given valid props, it should start unembedded and record NodeCreated", () => {
  const node = makeNode([EventId.from("e1")]);

  expect(node.embedding).toBeNull();
  expect(node.pullDomainEvents().map((event) => event.eventName)).toEqual([
    "NodeCreated",
  ]);
});

test("KnowledgeGraphNode.create: given no event ids, it should fail with MissingProvenanceError", () => {
  const result = KnowledgeGraphNode.create({
    id: NodeId.generate(),
    graphId: KnowledgeGraphId.generate(),
    type: NodeType.PERSON,
    body: body(),
    eventIds: [],
    now: NOW,
  });

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("MissingProvenanceError");
});

test("KnowledgeGraphNode.create: given duplicate event ids, it should de-duplicate provenance by value", () => {
  const node = makeNode([EventId.from("e1"), EventId.from("e1")]);

  expect(node.eventIds).toHaveLength(1);
});

test("KnowledgeGraphNode.attachEvents: given a new event, it should grow provenance and record NodeProvenanceExtended", () => {
  const node = makeNode([EventId.from("e1")]);
  node.pullDomainEvents();

  node.attachEvents([EventId.from("e2")], NOW);

  expect(node.eventIds).toHaveLength(2);
  expect(node.pullDomainEvents().map((event) => event.eventName)).toEqual([
    "NodeProvenanceExtended",
  ]);
});

test("KnowledgeGraphNode.attachEvents: given only already-known events, it should not change state or record an event", () => {
  const node = makeNode([EventId.from("e1")]);
  node.pullDomainEvents();

  node.attachEvents([EventId.from("e1")], NOW);

  expect(node.eventIds).toHaveLength(1);
  expect(node.pullDomainEvents()).toHaveLength(0);
});

test("KnowledgeGraphNode.assignEmbedding: given an embedding, it should store it and record NodeEmbedded", () => {
  const node = makeNode([EventId.from("e1")]);
  node.pullDomainEvents();
  const embedding = Embedding.create([0.1, 0.2, 0.3], "m");
  if (!embedding.ok) throw new Error("embedding setup failed");

  node.assignEmbedding(embedding.value, NOW);

  expect(node.embedding?.dimensions).toBe(3);
  expect(node.pullDomainEvents().map((event) => event.eventName)).toEqual([
    "NodeEmbedded",
  ]);
});
