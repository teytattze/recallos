import type { ClientSession, Collection, Filter, MongoClient } from "mongodb";

import { Tenant } from "@repo/server-kernel";
import { EventId, GraphNode } from "@repo/server-knowledge-core";
import { expect, test } from "bun:test";

import type { MongodbGraphNodeModel } from "./mongodb-model.ts";

import { MongodbGraphNodeRepository } from "./mongodb-graph-node-repository.ts";

type InsertOneOptions = Parameters<
  Collection<MongodbGraphNodeModel>["insertOne"]
>[1];
type FindOneOptions = Parameters<
  Collection<MongodbGraphNodeModel>["findOne"]
>[1];

class FakeCollection {
  readonly calls: {
    model: MongodbGraphNodeModel;
    options: InsertOneOptions;
  }[] = [];
  readonly findOneCalls: {
    filter: Filter<MongodbGraphNodeModel>;
    options: FindOneOptions;
  }[] = [];
  findOneResult: MongodbGraphNodeModel | null = null;
  error?: Error;

  findOne(
    filter: Filter<MongodbGraphNodeModel>,
    options: FindOneOptions,
  ): Promise<MongodbGraphNodeModel | null> {
    this.findOneCalls.push({ filter, options });
    return Promise.resolve(this.findOneResult);
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

test("MongodbGraphNodeRepository.findByEventId: given a tenant event node, it should restore the graph node", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const session = { id: "session-1" } as unknown as ClientSession;
  client.collection.findOneResult = {
    _id: "node-1",
    createdAt,
    updatedAt,
    tenant,
    embedding: [0.1, 0.2],
    eventId,
    graphId,
    rawEvent: { issue: { key: eventId } },
  };
  const repository = new MongodbGraphNodeRepository(
    client as unknown as MongoClient,
    "recallos",
    session,
  );

  // WHEN
  const node = await repository.findByEventId({
    eventId: EventId.restore({ payload: eventId }),
    tenant: Tenant.fromString(tenant),
  });

  // THEN
  expect(client.collection.findOneCalls).toEqual([
    {
      filter: { eventId, tenant },
      options: { session },
    },
  ]);
  expect(node?.id.toString()).toBe("node-1");
  expect(node?.metadata.createdAt).toEqual(createdAt);
  expect(node?.metadata.updatedAt).toEqual(updatedAt);
  expect(node?.tenant.toString()).toBe(tenant);
  expect(node?.embedding).toEqual([0.1, 0.2]);
  expect(node?.eventId.toString()).toBe(eventId);
  expect(node?.graphId.toString()).toBe(graphId);
  expect(node?.rawEvent).toEqual({ issue: { key: eventId } });
});

test("MongodbGraphNodeRepository.findByEventId: given no tenant event node, it should return null", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const repository = new MongodbGraphNodeRepository(
    client as unknown as MongoClient,
    "recallos",
  );

  // WHEN
  const node = await repository.findByEventId({
    eventId: EventId.restore({ payload: eventId }),
    tenant: Tenant.fromString(tenant),
  });

  // THEN
  expect(node).toBeNull();
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
