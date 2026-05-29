import { type Clock, type DomainEvent, fixedClock } from "@repo/server-kernel";
import { expect, test } from "bun:test";

import type { NodeId } from "../../domain/node-id.value-object.ts";

import { EventId } from "../../domain/event-id.value-object.ts";
import { KnowledgeGraphNode } from "../../domain/knowledge-graph-node.aggregate.ts";
import { KnowledgeGraph } from "../../domain/knowledge-graph.aggregate.ts";
import { EmbedNodesUseCase } from "./embed-nodes.use-case.ts";

const clock: Clock = fixedClock(new Date("2026-05-29T00:00:00Z"));

const graphResult = KnowledgeGraph.create({
  name: "people",
  embeddingModel: "text-embed-3",
  embeddingDimensions: 3,
  now: clock.now(),
});
if (!graphResult.ok) throw new Error("setup failed");
const graph = graphResult.value;

function makeNode(): KnowledgeGraphNode {
  const result = KnowledgeGraphNode.create({
    graphId: graph.id,
    type: "PERSON",
    body: "Ada Lovelace",
    eventIds: [EventId.create()],
    now: clock.now(),
  });
  if (!result.ok) throw new Error("setup failed");
  // Drain the NodeCreated event so the node mimics one loaded from persistence.
  result.value.pullDomainEvents();
  return result.value;
}

function buildUseCase(needingEmbedding: KnowledgeGraphNode[]) {
  const saved: KnowledgeGraphNode[] = [];
  const published: DomainEvent[] = [];
  const nodes = {
    findById: async () => null,
    findByIds: async (ids: NodeId[]) =>
      needingEmbedding.filter((n) => ids.some((id) => id.equals(n.id))),
    findByNaturalKey: async () => null,
    findNeedingEmbedding: async () => needingEmbedding,
    saveMany: async (input: KnowledgeGraphNode[]) => {
      saved.push(...input);
    },
  };
  const graphs = { findById: async () => graph };
  const embeddings = {
    embed: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3]),
  };
  const publisher = {
    publish: async (events: readonly DomainEvent[]) => {
      published.push(...events);
    },
  };
  const uow = { run: <T>(work: () => Promise<T>) => work() };

  const useCase = new EmbedNodesUseCase(
    nodes,
    graphs,
    embeddings,
    publisher,
    uow,
    clock,
  );
  return { useCase, saved, published };
}

test("EmbedNodesUseCase.execute: given nodes needing embedding, it should assign embeddings", async () => {
  // GIVEN
  const node = makeNode();
  const { useCase, saved } = buildUseCase([node]);

  // WHEN
  const result = await useCase.execute({ limit: 10 });

  // THEN
  expect(result.ok && result.value.embedded).toBe(1);
  expect(node.embedding?.model).toBe("text-embed-3");
  expect(saved).toHaveLength(1);
});

test("EmbedNodesUseCase.execute: given no nodes, it should be a no-op", async () => {
  // GIVEN
  const { useCase } = buildUseCase([]);

  // WHEN
  const result = await useCase.execute({ limit: 10 });

  // THEN
  expect(result.ok && result.value.embedded).toBe(0);
});

test("EmbedNodesUseCase.execute: given embedded nodes, it should publish a NodeEmbedded event", async () => {
  // GIVEN
  const { useCase, published } = buildUseCase([makeNode()]);

  // WHEN
  await useCase.execute({ limit: 10 });

  // THEN
  expect(published).toHaveLength(1);
  expect(published[0]!.eventName).toBe("knowledge.NodeEmbedded");
});
