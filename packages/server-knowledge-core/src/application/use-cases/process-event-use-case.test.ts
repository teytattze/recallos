import { createFixedClock } from "@repo/server-kernel";
import { AppError } from "@repo/app-error";
import { expect, test } from "bun:test";

import type {
  EmbeddingGatewayPort,
  EmbeddingGatewayPortEmbedInput,
  EmbeddingGatewayPortEmbedOutput,
} from "../ports/outbound/embedding-gateway-port.ts";
import type {
  GraphNodeRepositoryPort,
  GraphNodeRepositoryPortFindManyInput,
  GraphNodeRepositoryPortFindManyOutput,
  GraphNodeRepositoryPortInsertInput,
  GraphNodeRepositoryPortInsertOutput,
  GraphNodeRepositoryPortSearchByEmbeddingInput,
  GraphNodeRepositoryPortSearchByEmbeddingOutput,
} from "../ports/outbound/graph-node-repository-port.ts";
import type {
  GraphRepositoryPort,
  GraphRepositoryPortCreateInput,
  GraphRepositoryPortCreateOutput,
  GraphRepositoryPortFindByIdInput,
  GraphRepositoryPortFindByIdOutput,
} from "../ports/outbound/graph-repository-port.ts";

import { Graph } from "../../domain/aggregates/graph.ts";
import { ProcessEventUseCase } from "./process-event-use-case.ts";

class FakeEmbeddingGateway implements EmbeddingGatewayPort {
  readonly inputs: EmbeddingGatewayPortEmbedInput[] = [];

  embed(
    input: EmbeddingGatewayPortEmbedInput,
  ): EmbeddingGatewayPortEmbedOutput {
    this.inputs.push(input);
    return Promise.resolve({ embedding: [0.1, 0.2] });
  }
}

class FakeGraphNodeRepository implements GraphNodeRepositoryPort {
  readonly inputs: GraphNodeRepositoryPortInsertInput[] = [];

  findMany(
    _input: GraphNodeRepositoryPortFindManyInput,
  ): GraphNodeRepositoryPortFindManyOutput {
    return Promise.resolve([]);
  }

  insert(
    input: GraphNodeRepositoryPortInsertInput,
  ): GraphNodeRepositoryPortInsertOutput {
    this.inputs.push(input);
    return Promise.resolve();
  }

  searchByEmbedding(
    _input: GraphNodeRepositoryPortSearchByEmbeddingInput,
  ): GraphNodeRepositoryPortSearchByEmbeddingOutput {
    return Promise.resolve([]);
  }
}

class FakeGraphRepository implements GraphRepositoryPort {
  constructor(private readonly graph: Graph | null) {}

  findById(
    _input: GraphRepositoryPortFindByIdInput,
  ): GraphRepositoryPortFindByIdOutput {
    return Promise.resolve(this.graph);
  }

  create(
    _input: GraphRepositoryPortCreateInput,
  ): GraphRepositoryPortCreateOutput {
    return Promise.resolve();
  }
}

const now = new Date("2026-01-02T00:00:00Z");
const tenant = "organization:org1";
const graphId = "01952d3f-0000-7000-8000-000000000100";
const event = { id: "event-1", raw: { issue: { key: "REC-1" } } };

const restoreGraph = (): Graph =>
  Graph.restore({
    tenant,
    metadata: { createdAt: now, updatedAt: now },
    payload: {
      id: graphId,
      embeddingMetadata: {
        payload: { dimension: "1024", model: "voyage-4-large" },
      },
    },
  });

test("ProcessEventUseCase.execute: given an existing graph, it should embed and persist one event", async () => {
  // GIVEN
  const embeddingGateway = new FakeEmbeddingGateway();
  const graphNodeRepository = new FakeGraphNodeRepository();
  const useCase = new ProcessEventUseCase(
    createFixedClock(now),
    embeddingGateway,
    new FakeGraphRepository(restoreGraph()),
    graphNodeRepository,
  );

  // WHEN
  await useCase.execute({ tenant, payload: { event, graphId } });

  // THEN
  expect(embeddingGateway.inputs).toEqual([
    {
      dimension: "1024",
      model: "voyage-4-large",
      text: JSON.stringify(event.raw),
      inputType: "document",
    },
  ]);
  expect(graphNodeRepository.inputs).toHaveLength(1);
  const node = graphNodeRepository.inputs[0]!.data;
  expect(node.tenant.toString()).toBe(tenant);
  expect(node.metadata.createdAt).toEqual(now);
  expect(node.metadata.updatedAt).toEqual(now);
  expect(node.embedding).toEqual([0.1, 0.2]);
  expect(node.eventId.toString()).toBe(event.id);
  expect(node.graphId.toString()).toBe(graphId);
  expect(node.rawEvent).toEqual(event.raw);
});

test("ProcessEventUseCase.execute: given a missing graph, it should throw before embedding or persistence", async () => {
  // GIVEN
  const embeddingGateway = new FakeEmbeddingGateway();
  const graphNodeRepository = new FakeGraphNodeRepository();
  const useCase = new ProcessEventUseCase(
    createFixedClock(now),
    embeddingGateway,
    new FakeGraphRepository(null),
    graphNodeRepository,
  );

  // WHEN
  const error = await useCase
    .execute({ tenant, payload: { event, graphId } })
    .catch((caught: unknown) => caught);

  // THEN
  expect(error).toBeInstanceOf(AppError);
  const appError = AppError.from(error);
  expect(appError.code).toBe("serverKnowledgeCore.graphNotFound");
  expect(embeddingGateway.inputs).toEqual([]);
  expect(graphNodeRepository.inputs).toEqual([]);
});
