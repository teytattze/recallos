import type {
  ClientSession,
  Collection,
  Document,
  Filter,
  MongoClient,
} from "mongodb";

import { Tenant } from "@repo/server-kernel";
import { EventId, GraphId, GraphNode } from "@repo/server-knowledge-core";
import { expect, test } from "bun:test";

import type { MongodbGraphNodeModel } from "./mongodb-model.ts";

import { MongodbGraphNodeRepository } from "./mongodb-graph-node-repository.ts";

type InsertOneOptions = Parameters<
  Collection<MongodbGraphNodeModel>["insertOne"]
>[1];
type FindOptions = Parameters<Collection<MongodbGraphNodeModel>["find"]>[1];
type AggregateOptions = Parameters<
  Collection<MongodbGraphNodeModel>["aggregate"]
>[1];

class FakeCollection {
  readonly calls: {
    model: MongodbGraphNodeModel;
    options: InsertOneOptions;
  }[] = [];
  readonly findCalls: {
    filter: Filter<MongodbGraphNodeModel>;
    options: FindOptions;
  }[] = [];
  readonly aggregateCalls: {
    pipeline: Document[];
    options: AggregateOptions;
  }[] = [];
  findResult: MongodbGraphNodeModel[] = [];
  aggregateResult: MongodbGraphNodeModel[] = [];
  error?: Error;

  find(
    filter: Filter<MongodbGraphNodeModel>,
    options: FindOptions,
  ): { toArray: () => Promise<MongodbGraphNodeModel[]> } {
    this.findCalls.push({ filter, options });
    return { toArray: () => Promise.resolve(this.findResult) };
  }

  aggregate(
    pipeline: Document[],
    options: AggregateOptions,
  ): { toArray: () => Promise<MongodbGraphNodeModel[]> } {
    this.aggregateCalls.push({ pipeline, options });
    return { toArray: () => Promise.resolve(this.aggregateResult) };
  }

  insertOne(
    model: MongodbGraphNodeModel,
    options: InsertOneOptions,
  ): Promise<void> {
    this.calls.push({ model, options });
    return this.error === undefined
      ? Promise.resolve()
      : Promise.reject(this.error);
  }
}

class FakeMongoClient {
  readonly collection = new FakeCollection();

  db(): { collection: () => FakeCollection } {
    return { collection: () => this.collection };
  }
}

const createdAt = new Date("2026-01-02T00:00:00Z");
const updatedAt = new Date("2026-01-03T00:00:00Z");
const graphId = "01952d3f-0000-7000-8000-000000000100";
const tenant = "organization:org1";
const eventId = "event-1";

const restoreNode = (): GraphNode =>
  GraphNode.restore({
    tenant,
    metadata: { createdAt, updatedAt },
    payload: {
      id: "node-1",
      embedding: [0.1, 0.2],
      eventId,
      graphId,
      rawEvent: { issue: { key: eventId } },
    },
  });

test("MongodbGraphNodeRepository.insert: given a graph node, it should insert its model with the session", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const session = { id: "session-1" } as unknown as ClientSession;
  const repository = new MongodbGraphNodeRepository(
    client as unknown as MongoClient,
    "recallos",
    session,
  );
  const node = restoreNode();

  // WHEN
  await repository.insert({ data: node });

  // THEN
  expect(client.collection.calls).toEqual([
    {
      model: {
        _id: node.id.toString(),
        createdAt,
        updatedAt,
        tenant: "organization:org1",
        embedding: [0.1, 0.2],
        eventId: "event-1",
        graphId,
        rawEvent: { issue: { key: "event-1" } },
      },
      options: { session },
    },
  ]);
});

test("MongodbGraphNodeRepository.findMany: given tenant and filters, it should restore matching graph nodes", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const session = { id: "session-1" } as unknown as ClientSession;
  client.collection.findResult = [
    {
      _id: "node-1",
      createdAt,
      updatedAt,
      tenant,
      embedding: [0.1, 0.2],
      eventId,
      graphId,
      rawEvent: { issue: { key: eventId } },
    },
  ];
  const repository = new MongodbGraphNodeRepository(
    client as unknown as MongoClient,
    "recallos",
    session,
  );

  // WHEN
  const nodes = await repository.findMany({
    tenant: Tenant.fromString(tenant),
    filters: {
      eventId: EventId.restore({ payload: eventId }),
      graphId: GraphId.restore({ payload: graphId }),
    },
  });

  // THEN
  expect(client.collection.findCalls).toEqual([
    {
      filter: { eventId, graphId, tenant },
      options: { session },
    },
  ]);
  expect(nodes).toHaveLength(1);
  const node = nodes[0]!;
  expect(node.id.toString()).toBe("node-1");
  expect(node.metadata.createdAt).toEqual(createdAt);
  expect(node.metadata.updatedAt).toEqual(updatedAt);
  expect(node.tenant.toString()).toBe(tenant);
  expect(node.embedding).toEqual([0.1, 0.2]);
  expect(node.eventId.toString()).toBe(eventId);
  expect(node.graphId.toString()).toBe(graphId);
  expect(node.rawEvent).toEqual({ issue: { key: eventId } });
});

test("MongodbGraphNodeRepository.findMany: given no matching graph nodes, it should return an empty list", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const repository = new MongodbGraphNodeRepository(
    client as unknown as MongoClient,
    "recallos",
  );

  // WHEN
  const nodes = await repository.findMany({
    tenant: Tenant.fromString(tenant),
    filters: {
      eventId: EventId.restore({ payload: eventId }),
      graphId: GraphId.restore({ payload: graphId }),
    },
  });

  // THEN
  expect(nodes).toEqual([]);
});

test("MongodbGraphNodeRepository.insert: given an insert error, it should rethrow it", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const thrown = new Error("network unavailable");
  client.collection.error = thrown;
  const repository = new MongodbGraphNodeRepository(
    client as unknown as MongoClient,
    "recallos",
  );

  // WHEN
  const error = await repository
    .insert({ data: restoreNode() })
    .catch((caught: unknown) => caught);

  // THEN
  expect(error).toBe(thrown);
});

test("MongodbGraphNodeRepository.searchByEmbedding: given tenant and graph id, it should run a limited vector search", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const session = { id: "session-1" } as unknown as ClientSession;
  client.collection.aggregateResult = [
    {
      _id: "node-1",
      createdAt,
      updatedAt,
      tenant,
      embedding: [0.1, 0.2],
      eventId,
      graphId,
      rawEvent: { issue: { key: eventId } },
    },
  ];
  const repository = new MongodbGraphNodeRepository(
    client as unknown as MongoClient,
    "recallos",
    session,
  );

  // WHEN
  const nodes = await repository.searchByEmbedding({
    tenant: Tenant.fromString(tenant),
    filters: { graphId: GraphId.restore({ payload: graphId }) },
    embedding: [0.4, 0.5],
    limit: 25,
  });

  // THEN
  expect(client.collection.aggregateCalls).toEqual([
    {
      pipeline: [
        {
          $vectorSearch: {
            index: "graph_node_embedding",
            path: "embedding",
            queryVector: [0.4, 0.5],
            limit: 10,
            numCandidates: 100,
            filter: { graphId, tenant },
          },
        },
      ],
      options: { session },
    },
  ]);
  expect(nodes).toHaveLength(1);
  expect(nodes[0]!.rawEvent).toEqual({ issue: { key: eventId } });
});
