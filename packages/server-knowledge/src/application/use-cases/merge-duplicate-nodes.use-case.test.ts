import { type Clock, fixedClock } from "@repo/server-kernel";
import { expect, test } from "bun:test";

import type { NodeId } from "../../domain/node-id.value-object.ts";

import { EventId } from "../../domain/event-id.value-object.ts";
import { KnowledgeGraphEdge } from "../../domain/knowledge-graph-edge.aggregate.ts";
import { KnowledgeGraphId } from "../../domain/knowledge-graph-id.value-object.ts";
import { KnowledgeGraphNode } from "../../domain/knowledge-graph-node.aggregate.ts";
import { MergeDuplicateNodesUseCase } from "./merge-duplicate-nodes.use-case.ts";

const clock: Clock = fixedClock(new Date("2026-05-29T00:00:00Z"));
const graphId = KnowledgeGraphId.create();

function makeNode(): KnowledgeGraphNode {
  const result = KnowledgeGraphNode.create({
    graphId,
    type: "PERSON",
    body: "Ada",
    eventIds: [EventId.create()],
    now: clock.now(),
  });
  if (!result.ok) throw new Error("setup failed");
  return result.value;
}

function duplicateOf(from: NodeId, to: NodeId): KnowledgeGraphEdge {
  const result = KnowledgeGraphEdge.create({
    graphId,
    fromId: from,
    toId: to,
    relationship: "DUPLICATE_OF",
    confidence: 1,
    sourceEventIds: [EventId.create()],
    observedAt: clock.now(),
    now: clock.now(),
  });
  if (!result.ok) throw new Error("setup failed");
  return result.value;
}

function buildUseCase(
  pending: KnowledgeGraphEdge[],
  nodesById: Map<string, KnowledgeGraphNode>,
) {
  const repoints: Array<{ from: string; to: string }> = [];
  const deleted: KnowledgeGraphEdge[] = [];
  const savedNodes: KnowledgeGraphNode[] = [];
  const nodes = {
    findById: async (id: NodeId) => nodesById.get(id.value) ?? null,
    findByIds: async () => [],
    findByNaturalKey: async () => null,
    findNeedingEmbedding: async () => [],
    saveMany: async (input: KnowledgeGraphNode[]) => {
      savedNodes.push(...input);
    },
  };
  const edges = {
    findByTriple: async () => null,
    findByRelationship: async () => pending,
    saveMany: async () => {},
    repointIncidentEdges: async (from: NodeId, to: NodeId) => {
      repoints.push({ from: from.value, to: to.value });
    },
    deleteMany: async (input: KnowledgeGraphEdge[]) => {
      deleted.push(...input);
    },
  };
  const publisher = { publish: async () => {} };
  const uow = { run: <T>(work: () => Promise<T>) => work() };

  const useCase = new MergeDuplicateNodesUseCase(
    nodes,
    edges,
    publisher,
    uow,
    clock,
  );
  return { useCase, repoints, deleted, savedNodes };
}

test("MergeDuplicateNodesUseCase.execute: given a duplicate edge, it should fold provenance into the survivor", async () => {
  // GIVEN
  const duplicate = makeNode();
  const survivor = makeNode();
  const nodesById = new Map([
    [duplicate.id.value, duplicate],
    [survivor.id.value, survivor],
  ]);
  const edge = duplicateOf(duplicate.id, survivor.id);
  const { useCase, repoints, deleted } = buildUseCase([edge], nodesById);

  // WHEN
  const result = await useCase.execute({ limit: 10 });

  // THEN
  expect(result.ok && result.value.merged).toBe(1);
  expect(survivor.eventIds.length).toBe(2);
  expect(repoints).toEqual([
    { from: duplicate.id.value, to: survivor.id.value },
  ]);
  expect(deleted).toContain(edge);
});

test("MergeDuplicateNodesUseCase.execute: given no backlog, it should be a no-op", async () => {
  // GIVEN
  const { useCase } = buildUseCase([], new Map());

  // WHEN
  const result = await useCase.execute({ limit: 10 });

  // THEN
  expect(result.ok && result.value.merged).toBe(0);
});

test("MergeDuplicateNodesUseCase.execute: given a dangling marker, it should still resolve the edge", async () => {
  // GIVEN — endpoints no longer exist
  const edge = duplicateOf(makeNode().id, makeNode().id);
  const { useCase, deleted } = buildUseCase([edge], new Map());

  // WHEN
  const result = await useCase.execute({ limit: 10 });

  // THEN
  expect(result.ok && result.value.merged).toBe(0);
  expect(deleted).toContain(edge);
});
