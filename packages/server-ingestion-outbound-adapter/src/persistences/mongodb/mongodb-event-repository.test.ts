import type { Collection, ClientSession, MongoClient } from "mongodb";

import { Event } from "@repo/server-ingestion-core";
import { EntityMetadata, Tenant } from "@repo/server-kernel";
import { test, expect } from "bun:test";

import type { MongodbEventModel } from "./mongodb-event-model";

import { MongodbEventRepository } from "./mongodb-event-repository";

type InsertOneOptions = Parameters<
  Collection<MongodbEventModel>["insertOne"]
>[1];
type InsertCall = {
  model: MongodbEventModel;
  options: InsertOneOptions;
};

class FakeCollection {
  readonly insertOneCalls: InsertCall[] = [];

  insertOne(
    model: MongodbEventModel,
    options: InsertOneOptions,
  ): Promise<void> {
    this.insertOneCalls.push({ model, options });
    return Promise.resolve();
  }
}

class FakeMongoClient {
  readonly collection = new FakeCollection();
  databaseName?: string;
  collectionName?: string;

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

const eventId = "01952d3f-0000-7000-8000-000000000000";
const createdAt = new Date("2026-01-02T00:00:00Z");
const updatedAt = new Date("2026-01-03T00:00:00Z");
const tenant = Tenant.create("organization", "org1");
const external = {
  id: "jira-123",
  provider: "jira",
} as const;
const graphId = "01952d3f-0000-7000-8000-000000000100";
const raw = {
  issue: { key: "REC-123", summary: "hello" },
};

test("MongodbEventRepository.insert: given an event, it should insert the MongoDB model with the session", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const session = { id: "session-1" } as unknown as ClientSession;
  const repository = new MongodbEventRepository(
    client as unknown as MongoClient,
    "recallos",
    session,
  );
  const event = Event.restore({
    tenant,
    metadata: EntityMetadata.restore(createdAt, updatedAt),
    payload: {
      id: eventId,
      external,
      graphId,
      raw,
    },
  });

  // WHEN
  await repository.insert(event);

  // THEN
  expect(client.databaseName).toBe("recallos");
  expect(client.collectionName).toBe("events");
  expect(client.collection.insertOneCalls).toEqual([
    {
      model: {
        _id: eventId,
        createdAt,
        updatedAt,
        tenant: "organization:org1",
        external,
        graphId,
        raw,
      },
      options: {
        session,
      },
    },
  ]);
});
