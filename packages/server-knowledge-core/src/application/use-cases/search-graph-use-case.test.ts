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

import { GraphNode } from "../../domain/aggregates/graph-node.ts";
import { Graph } from "../../domain/aggregates/graph.ts";
import { SearchGraphUseCase } from "./search-graph-use-case.ts";

class FakeEmbeddingGateway implements EmbeddingGatewayPort {
  readonly embedInputs: EmbeddingGatewayPortEmbedInput[] = [];

  embed(
    input: EmbeddingGatewayPortEmbedInput,
  ): EmbeddingGatewayPortEmbedOutput {
    this.embedInputs.push(input);
    return Promise.resolve({ embedding: [0.4, 0.5] });
  }
}

class FakeGraphRepository implements GraphRepositoryPort {
  readonly findByIdInputs: GraphRepositoryPortFindByIdInput[] = [];

  constructor(private readonly graph: Graph | null) {}

  findById(
    input: GraphRepositoryPortFindByIdInput,
  ): GraphRepositoryPortFindByIdOutput {
    this.findByIdInputs.push(input);
    return Promise.resolve(this.graph);
  }

  create(
    _input: GraphRepositoryPortCreateInput,
  ): GraphRepositoryPortCreateOutput {
    return Promise.resolve();
  }
}

class FakeGraphNodeRepository implements GraphNodeRepositoryPort {
  readonly searchInputs: GraphNodeRepositoryPortSearchByEmbeddingInput[] = [];

  constructor(private readonly graphNodes: GraphNode[]) {}

  findMany(
    _input: GraphNodeRepositoryPortFindManyInput,
  ): GraphNodeRepositoryPortFindManyOutput {
    return Promise.resolve([]);
  }

  insert(
    _input: GraphNodeRepositoryPortInsertInput,
  ): GraphNodeRepositoryPortInsertOutput {
    return Promise.resolve();
  }

  searchByEmbedding(
    input: GraphNodeRepositoryPortSearchByEmbeddingInput,
  ): GraphNodeRepositoryPortSearchByEmbeddingOutput {
    this.searchInputs.push(input);
    return Promise.resolve(this.graphNodes);
  }
}

const tenant = "organization:org1";
const graphId = "01952d3f-0000-7000-8000-000000000100";

const restoreGraph = (): Graph =>
  Graph.restore({
    tenant,
    metadata: {
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    },
    payload: {
      id: graphId,
      embeddingMetadata: {
        payload: { dimension: "1024", model: "voyage-4-large" },
      },
    },
  });

const restoreGraphNode = (): GraphNode =>
  GraphNode.restore({
    tenant,
    metadata: {
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-03T00:00:00Z"),
    },
    payload: {
      id: "01952d3f-0000-7000-8000-000000000200",
      embedding: [0.1, 0.2],
      eventId: "event-1",
      graphId,
      rawEvent: { issue: { key: "REC-1" } },
    },
  });

test("SearchGraphUseCase.execute: given a query, it should search graph node embeddings and return raw event DTOs", async () => {
  const embeddingGateway = new FakeEmbeddingGateway();
  const graphRepository = new FakeGraphRepository(restoreGraph());
  const graphNodeRepository = new FakeGraphNodeRepository([restoreGraphNode()]);
  const useCase = new SearchGraphUseCase(
    embeddingGateway,
    graphRepository,
    graphNodeRepository,
  );

  const output = await useCase.execute({
    tenant,
    payload: { graphId, query: "billing incident" },
  });

  expect(graphRepository.findByIdInputs).toHaveLength(1);
  expect(graphRepository.findByIdInputs[0]!.tenant.toString()).toBe(tenant);
  expect(graphRepository.findByIdInputs[0]!.id.toString()).toBe(graphId);
  expect(embeddingGateway.embedInputs).toEqual([
    {
      model: "voyage-4-large",
      dimension: "1024",
      text: "billing incident",
      inputType: "query",
    },
  ]);
  expect(graphNodeRepository.searchInputs).toHaveLength(1);
  const searchInput = graphNodeRepository.searchInputs[0]!;
  expect(searchInput.tenant.toString()).toBe(tenant);
  expect(searchInput.filters.graphId.toString()).toBe(graphId);
  expect(searchInput.embedding).toEqual([0.4, 0.5]);
  expect(searchInput.limit).toBe(10);
  expect(output).toEqual({ data: [{ rawEvent: { issue: { key: "REC-1" } } }] });
});

test("SearchGraphUseCase.execute: given a missing graph, it should throw before embedding or search", async () => {
  const embeddingGateway = new FakeEmbeddingGateway();
  const graphNodeRepository = new FakeGraphNodeRepository([]);
  const useCase = new SearchGraphUseCase(
    embeddingGateway,
    new FakeGraphRepository(null),
    graphNodeRepository,
  );

  const error = await useCase
    .execute({ tenant, payload: { graphId, query: "billing incident" } })
    .catch((caught: unknown) => caught);

  expect(error).toHaveProperty("kind", "GraphNotFound");
  expect(embeddingGateway.embedInputs).toEqual([]);
  expect(graphNodeRepository.searchInputs).toEqual([]);
});
