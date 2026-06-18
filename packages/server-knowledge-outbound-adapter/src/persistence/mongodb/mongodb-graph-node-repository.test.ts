import type { ClientSession, Collection, MongoClient } from "mongodb";

import { GraphNode } from "@repo/server-knowledge-core";
import { expect, test } from "bun:test";

import type { MongodbGraphNodeModel } from "./mongodb-model.ts";

import { MongodbGraphNodeRepository } from "./mongodb-graph-node-repository.ts";

type InsertOneOptions = Parameters<
  Collection<MongodbGraphNodeModel>["insertOne"]
>[1];

class FakeCollection {
  readonly calls: {
    model: MongodbGraphNodeModel;
    options: InsertOneOptions;
  }[] = [];
  error?: Error;

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

const restoreNode = (): GraphNode =>
  GraphNode.restore({
    tenant: "organization:org1",
    metadata: { createdAt, updatedAt },
    payload: {
      id: "node-1",
      embedding: [0.1, 0.2],
      eventId: "event-1",
      graphId,
      rawEvent: { issue: { key: "event-1" } },
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
