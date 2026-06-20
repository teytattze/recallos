import { expect, test } from "bun:test";

import type {
  GraphNodeRepositoryPort,
  GraphNodeRepositoryPortFindByEventIdInput,
  GraphNodeRepositoryPortFindByEventIdOutput,
  GraphNodeRepositoryPortInsertInput,
  GraphNodeRepositoryPortInsertOutput,
} from "../ports/outbound/graph-node-repository-port.ts";

import { GraphNode } from "../../domain/aggregates/graph-node.ts";
import { GetGraphNodeByEventIdUseCase } from "./get-graph-node-by-event-id-use-case.ts";

class FakeGraphNodeRepository implements GraphNodeRepositoryPort {
  readonly findByEventIdInputs: GraphNodeRepositoryPortFindByEventIdInput[] =
    [];

  constructor(private readonly graphNode: GraphNode | null) {}

  findByEventId(
    input: GraphNodeRepositoryPortFindByEventIdInput,
  ): GraphNodeRepositoryPortFindByEventIdOutput {
    this.findByEventIdInputs.push(input);
    return Promise.resolve(this.graphNode);
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

test("GetGraphNodeByEventIdUseCase.execute: given an existing graph node, it should return its transport DTO", async () => {
  // GIVEN
  const graphNodeRepository = new FakeGraphNodeRepository(restoreGraphNode());
  const useCase = new GetGraphNodeByEventIdUseCase(graphNodeRepository);

  // WHEN
  const output = await useCase.execute({
    tenant,
    payload: { eventId },
  });

  // THEN
  expect(graphNodeRepository.findByEventIdInputs).toHaveLength(1);
  expect(graphNodeRepository.findByEventIdInputs[0]!.tenant.toString()).toBe(
    tenant,
  );
  expect(graphNodeRepository.findByEventIdInputs[0]!.eventId.toString()).toBe(
    eventId,
  );
  expect(output).toEqual({
    id: graphNodeId,
    tenant,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    eventId,
    graphId,
    rawEvent,
  });
  expect(output).not.toHaveProperty("embedding");
});

test("GetGraphNodeByEventIdUseCase.execute: given a missing graph node, it should throw a not-found domain error", async () => {
  // GIVEN
  const graphNodeRepository = new FakeGraphNodeRepository(null);
  const useCase = new GetGraphNodeByEventIdUseCase(graphNodeRepository);

  // WHEN
  const error = await useCase
    .execute({ tenant, payload: { eventId } })
    .catch((caught: unknown) => caught);

  // THEN
  expect(error).toEqual({
    kind: "GraphNodeNotFound",
    category: "not-found",
    message: "Graph node not found",
    details: { eventId, tenant },
  });
});
