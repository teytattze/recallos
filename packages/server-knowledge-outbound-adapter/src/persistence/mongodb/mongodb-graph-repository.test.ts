import type { ClientSession, Collection, MongoClient } from "mongodb";

import { Tenant } from "@repo/server-kernel";
import { Graph, GraphId } from "@repo/server-knowledge-core";
import { expect, test } from "bun:test";

import type { MongodbGraphModel } from "./mongodb-model.ts";

import { MongodbGraphRepository } from "./mongodb-graph-repository.ts";

type FindOneFilter = Parameters<Collection<MongodbGraphModel>["findOne"]>[0];
type FindOneOptions = Parameters<Collection<MongodbGraphModel>["findOne"]>[1];
type InsertOneOptions = Parameters<
  Collection<MongodbGraphModel>["insertOne"]
>[1];

class FakeCollection {
  readonly findOneCalls: { filter: FindOneFilter; options: FindOneOptions }[] =
    [];
  readonly insertOneCalls: {
    model: MongodbGraphModel;
    options: InsertOneOptions;
  }[] = [];

  constructor(private readonly found: MongodbGraphModel | null) {}

  findOne(
    filter: FindOneFilter,
    options: FindOneOptions,
  ): Promise<MongodbGraphModel | null> {
    this.findOneCalls.push({ filter, options });
    return Promise.resolve(this.found);
  }

  insertOne(
    model: MongodbGraphModel,
    options: InsertOneOptions,
  ): Promise<void> {
    this.insertOneCalls.push({ model, options });
    return Promise.resolve();
  }
}

class FakeMongoClient {
  readonly collection: FakeCollection;
  databaseName?: string;
  collectionName?: string;

  constructor(found: MongodbGraphModel | null = null) {
    this.collection = new FakeCollection(found);
  }

  db(databaseName: string): {
    collection: (collectionName: string) => FakeCollection;
  } {
    this.databaseName = databaseName;
    return {
      collection: (collectionName) => {
        this.collectionName = collectionName;
        return this.collection;
      },
    };
  }
}

const id = "01952d3f-0000-7000-8000-000000000100";
const tenant = "organization:org1";
const createdAt = new Date("2026-01-02T00:00:00Z");
const updatedAt = new Date("2026-01-03T00:00:00Z");
const storedModel = {
  _id: id,
  createdAt,
  updatedAt,
  tenant,
  embeddingMetadata: {
    dimension: "1024",
    model: "voyage-4-large",
  },
} satisfies MongodbGraphModel;

test("MongodbGraphRepository.findById: given a stored graph, it should query by id and tenant and restore it", async () => {
  // GIVEN
  const client = new FakeMongoClient(storedModel);
  const session = { id: "session-1" } as unknown as ClientSession;
  const repository = new MongodbGraphRepository(
    client as unknown as MongoClient,
    "recallos",
    session,
  );

  // WHEN
  const graph = await repository.findById({
    id: GraphId.restore({ payload: id }),
    tenant: Tenant.fromString(tenant),
  });

  // THEN
  expect(client.databaseName).toBe("recallos");
  expect(client.collectionName).toBe("graphs");
  expect(client.collection.findOneCalls).toEqual([
    { filter: { _id: id, tenant }, options: { session } },
  ]);
  expect(graph?.id.toString()).toBe(id);
  expect(graph?.tenant.toString()).toBe(tenant);
  expect(graph?.metadata.createdAt).toEqual(createdAt);
  expect(graph?.embeddingMetadata.toJSON()).toEqual(
    storedModel.embeddingMetadata,
  );
});

test("MongodbGraphRepository.findById: given no stored graph, it should return null", async () => {
  // GIVEN
  const repository = new MongodbGraphRepository(
    new FakeMongoClient() as unknown as MongoClient,
    "recallos",
  );

  // WHEN
  const graph = await repository.findById({
    id: GraphId.restore({ payload: id }),
    tenant: Tenant.fromString(tenant),
  });

  // THEN
  expect(graph).toBeNull();
});

test("MongodbGraphRepository.create: given a graph, it should insert its MongoDB model with the session", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const session = { id: "session-1" } as unknown as ClientSession;
  const repository = new MongodbGraphRepository(
    client as unknown as MongoClient,
    "recallos",
    session,
  );
  const graph = Graph.restore({
    tenant,
    metadata: { createdAt, updatedAt },
    payload: {
      id,
      embeddingMetadata: { payload: storedModel.embeddingMetadata },
    },
  });

  // WHEN
  await repository.create({ data: graph });

  // THEN
  expect(client.collection.insertOneCalls).toEqual([
    { model: storedModel, options: { session } },
  ]);
});
