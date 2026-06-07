import { EntityMetadata, Tenant, createFixedClock } from "@repo/server-kernel";
import { expect, test } from "bun:test";

import type { GraphEdge } from "../../domain/aggregates/graph-edge.ts";
import type { EmbeddingGatewayPort } from "../ports/outbound/embedding-gateway-port.ts";
import type { GraphEdgeRepositoryPort } from "../ports/outbound/graph-edge-repository-port.ts";
import type { GraphNodeRepositoryPort } from "../ports/outbound/graph-node-repository-port.ts";
import type { ProcessedEventRepositoryPort } from "../ports/outbound/processed-event-repository-port.ts";
import type {
  UnitOfWorkPort,
  UnitOfWorkPortContext,
} from "../ports/outbound/unit-of-work-port.ts";

import { GraphNode } from "../../domain/aggregates/graph-node.ts";
import { EventId } from "../../domain/value-objects/event-id.ts";
import { GraphId } from "../../domain/value-objects/graph-id.ts";
import { ProcessEventUseCase } from "./process-event-use-case.ts";

class FakeEmbeddingGateway implements EmbeddingGatewayPort {
  calls = 0;

  embed(): Promise<number[][]> {
    this.calls += 1;
    return Promise.resolve([[0.1, 0.2, 0.3]]);
  }
}

class FakeProcessedEventRepository implements ProcessedEventRepositoryPort {
  readonly inserted: EventId[] = [];

  constructor(private readonly seenResult: boolean) {}

  exists(): Promise<boolean> {
    return Promise.resolve(this.seenResult);
  }

  insert(input: { payload: { eventId: EventId } }): Promise<void> {
    this.inserted.push(input.payload.eventId);
    return Promise.resolve();
  }
}

class FakeGraphNodeRepository implements GraphNodeRepositoryPort {
  readonly inserted: GraphNode[] = [];
  searchCalls = 0;

  constructor(private readonly relatedNodes: GraphNode[]) {}

  searchByEmbedding(): Promise<GraphNode[]> {
    this.searchCalls += 1;
    return Promise.resolve(this.relatedNodes);
  }

  insert(input: { payload: GraphNode }): Promise<void> {
    this.inserted.push(input.payload);
    return Promise.resolve();
  }
}

class FakeGraphEdgeRepository implements GraphEdgeRepositoryPort {
  readonly inserted: GraphEdge[] = [];

  insertMany(input: { payload: GraphEdge[] }): Promise<void> {
    this.inserted.push(...input.payload);
    return Promise.resolve();
  }
}

class FakeUnitOfWork implements UnitOfWorkPort {
  readonly graphEdgeRepository = new FakeGraphEdgeRepository();
  ran = 0;

  constructor(
    readonly graphNodeRepository: FakeGraphNodeRepository,
    readonly processedEventRepository: FakeProcessedEventRepository,
  ) {}

  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T> {
    this.ran += 1;
    return work({
      graphNodeRepository: this.graphNodeRepository,
      graphEdgeRepository: this.graphEdgeRepository,
      processedEventRepository: this.processedEventRepository,
    });
  }
}

const now = new Date("2026-01-02T00:00:00Z");
const tenant = Tenant.create("organization", "org1");
const graphId = GraphId.create();
const eventId = EventId.create();

const input = {
  tenant,
  payload: {
    event: {
      id: eventId.value,
      createdAt: now,
      occurredAt: new Date("2026-01-01T00:00:00Z"),
      body: "Ada Lovelace",
      tags: { source: "slack" },
      graphId: graphId.value,
    },
  },
};

const createRelatedNode = (): GraphNode => {
  const result = GraphNode.create({
    tenant,
    metadata: EntityMetadata.create(now),
    payload: {
      graphId,
      body: "Grace Hopper",
      eventIds: [EventId.create()],
    },
  });
  if (!result.ok) throw new Error("expected ok node");
  return result.value;
};

test("ProcessEventUseCase.execute: given an already-processed event, it should return ok without writing", async () => {
  // GIVEN
  const embeddingGateway = new FakeEmbeddingGateway();
  const processedEventRepository = new FakeProcessedEventRepository(true);
  const graphNodeRepository = new FakeGraphNodeRepository([]);
  const uow = new FakeUnitOfWork(graphNodeRepository, processedEventRepository);
  const useCase = new ProcessEventUseCase(
    createFixedClock(now),
    embeddingGateway,
    processedEventRepository,
    graphNodeRepository,
    uow,
  );

  // WHEN
  const result = await useCase.execute(input);

  // THEN
  expect(result.ok).toBe(true);
  expect(embeddingGateway.calls).toBe(0);
  expect(graphNodeRepository.searchCalls).toBe(0);
  expect(uow.ran).toBe(0);
  expect(processedEventRepository.inserted).toHaveLength(0);
});

test("ProcessEventUseCase.execute: given a new event, it should create a node, related edges, and a processed-event marker in one transaction", async () => {
  // GIVEN
  const embeddingGateway = new FakeEmbeddingGateway();
  const processedEventRepository = new FakeProcessedEventRepository(false);
  const graphNodeRepository = new FakeGraphNodeRepository([
    createRelatedNode(),
  ]);
  const uow = new FakeUnitOfWork(graphNodeRepository, processedEventRepository);
  const useCase = new ProcessEventUseCase(
    createFixedClock(now),
    embeddingGateway,
    processedEventRepository,
    graphNodeRepository,
    uow,
  );

  // WHEN
  const result = await useCase.execute(input);

  // THEN
  expect(result.ok).toBe(true);
  expect(embeddingGateway.calls).toBe(1);
  expect(graphNodeRepository.searchCalls).toBe(1);
  expect(uow.ran).toBe(1);
  expect(processedEventRepository.inserted[0]?.value).toBe(eventId.value);
  expect(graphNodeRepository.inserted).toHaveLength(1);
  expect(uow.graphEdgeRepository.inserted).toHaveLength(1);
});
