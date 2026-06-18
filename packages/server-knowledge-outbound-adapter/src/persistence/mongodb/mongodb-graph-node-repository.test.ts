import type {
  AnyBulkWriteOperation,
  BulkWriteOptions,
  ClientSession,
  MongoClient,
} from "mongodb";

import { GraphNode } from "@repo/server-knowledge-core";
import { expect, test } from "bun:test";
import { MongoBulkWriteError } from "mongodb";

import type { MongodbGraphNodeModel } from "./mongodb-model.ts";

import { MongodbGraphNodeRepository } from "./mongodb-graph-node-repository.ts";

class FakeCollection {
  readonly calls: {
    operations: ReadonlyArray<AnyBulkWriteOperation<MongodbGraphNodeModel>>;
    options: BulkWriteOptions;
  }[] = [];
  error?: Error;

  bulkWrite(
    operations: ReadonlyArray<AnyBulkWriteOperation<MongodbGraphNodeModel>>,
    options: BulkWriteOptions,
  ): Promise<void> {
    this.calls.push({ operations, options });
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

const restoreNode = (id: string, eventId: string): GraphNode =>
  GraphNode.restore({
    tenant: "organization:org1",
    metadata: { createdAt, updatedAt },
    payload: {
      id,
      embedding: [0.1, 0.2],
      eventId,
      graphId,
      rawEvent: { issue: { key: eventId } },
    },
  });

test("MongodbGraphNodeRepository.insertMany: given graph nodes, it should bulk insert their models and return successes", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const session = { id: "session-1" } as unknown as ClientSession;
  const repository = new MongodbGraphNodeRepository(
    client as unknown as MongoClient,
    "recallos",
    session,
  );
  const nodes = [
    restoreNode("node-1", "event-1"),
    restoreNode("node-2", "event-2"),
  ];

  // WHEN
  const result = await repository.insertMany({ data: nodes });

  // THEN
  expect(client.collection.calls).toEqual([
    {
      operations: nodes.map((node, index) => ({
        insertOne: {
          document: {
            _id: node.id.toString(),
            createdAt,
            updatedAt,
            tenant: "organization:org1",
            embedding: [0.1, 0.2],
            eventId: `event-${index + 1}`,
            graphId,
            rawEvent: { issue: { key: `event-${index + 1}` } },
          },
        },
      })),
      options: { ordered: false, session },
    },
  ]);
  expect(result).toEqual([
    { id: nodes[0]!.id, status: "success" },
    { id: nodes[1]!.id, status: "success" },
  ]);
});

test("MongodbGraphNodeRepository.insertMany: given no graph nodes, it should return without writing", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const repository = new MongodbGraphNodeRepository(
    client as unknown as MongoClient,
    "recallos",
  );

  // WHEN
  const result = await repository.insertMany({ data: [] });

  // THEN
  expect(result).toEqual([]);
  expect(client.collection.calls).toEqual([]);
});

test("MongodbGraphNodeRepository.insertMany: given an individual write failure, it should report that node as failed", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  client.collection.error = Object.assign(
    Object.create(MongoBulkWriteError.prototype) as MongoBulkWriteError,
    { writeErrors: [{ index: 1 }] },
  );
  const repository = new MongodbGraphNodeRepository(
    client as unknown as MongoClient,
    "recallos",
  );
  const nodes = [
    restoreNode("node-1", "event-1"),
    restoreNode("node-2", "event-2"),
  ];

  // WHEN
  const result = await repository.insertMany({ data: nodes });

  // THEN
  expect(result).toEqual([
    { id: nodes[0]!.id, status: "success" },
    { id: nodes[1]!.id, status: "failed" },
  ]);
});

test("MongodbGraphNodeRepository.insertMany: given a non-write error, it should rethrow it", async () => {
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
    .insertMany({ data: [restoreNode("node-1", "event-1")] })
    .catch((caught: unknown) => caught);

  // THEN
  expect(error).toBe(thrown);
});
