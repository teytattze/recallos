import { expect, test } from "bun:test";

import type {
  GraphNodeRepositoryPort,
  GraphNodeRepositoryPortFindManyInput,
  GraphNodeRepositoryPortFindManyOutput,
  GraphNodeRepositoryPortInsertInput,
  GraphNodeRepositoryPortInsertOutput,
} from "../ports/outbound/graph-node-repository-port.ts";

import { GraphNode } from "../../domain/aggregates/graph-node.ts";
import { ListGraphNodesUseCase } from "./list-graph-nodes-use-case.ts";

class FakeGraphNodeRepository implements GraphNodeRepositoryPort {
  readonly findManyInputs: GraphNodeRepositoryPortFindManyInput[] = [];

  constructor(private readonly graphNodes: GraphNode[]) {}

  findMany(
    input: GraphNodeRepositoryPortFindManyInput,
  ): GraphNodeRepositoryPortFindManyOutput {
    this.findManyInputs.push(input);
    return Promise.resolve(this.graphNodes);
  }

  insert(
    _input: GraphNodeRepositoryPortInsertInput,
  ): GraphNodeRepositoryPortInsertOutput {
    return Promise.resolve();
  }
}

const tenant = "organization:org1";
const graphNodeId = "01952d3f-0000-7000-8000-000000000200";
const graphId = "01952d3f-0000-7000-8000-000000000100";
const eventId = "event-1";
const createdAt = new Date("2026-01-02T00:00:00Z");
const updatedAt = new Date("2026-01-03T00:00:00Z");
const rawEvent = { issue: { key: "REC-1" } };

const restoreGraphNode = (): GraphNode =>
  GraphNode.restore({
    tenant,
    metadata: { createdAt, updatedAt },
    payload: {
      id: graphNodeId,
      embedding: [0.1, 0.2],
      eventId,
      graphId,
      rawEvent,
    },
  });

test("ListGraphNodesUseCase.execute: given matching graph nodes, it should return their transport DTOs", async () => {
  const graphNodeRepository = new FakeGraphNodeRepository([restoreGraphNode()]);
  const useCase = new ListGraphNodesUseCase(graphNodeRepository);

  const output = await useCase.execute({
    tenant,
    filters: { eventId, graphId },
  });

  expect(graphNodeRepository.findManyInputs).toHaveLength(1);
  const repositoryInput = graphNodeRepository.findManyInputs[0]!;
  expect(repositoryInput.tenant.toString()).toBe(tenant);
  expect(repositoryInput.filters.eventId.toString()).toBe(eventId);
  expect(repositoryInput.filters.graphId.toString()).toBe(graphId);
  expect(output).toEqual([
    {
      id: graphNodeId,
      tenant,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      eventId,
      graphId,
      rawEvent,
    },
  ]);
  expect(output[0]).not.toHaveProperty("embedding");
});

test("ListGraphNodesUseCase.execute: given no matching graph nodes, it should return an empty list", async () => {
  const useCase = new ListGraphNodesUseCase(new FakeGraphNodeRepository([]));

  const output = await useCase.execute({
    tenant,
    filters: { eventId, graphId },
  });

  expect(output).toEqual([]);
});
