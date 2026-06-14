import type { Collection, MongoClient } from "mongodb";

import { Event } from "@repo/server-ingestion-core";
import { test, expect } from "bun:test";

import type { MongodbEventModel } from "./mongodb-event-model";

import { MongodbUnitOfWork } from "./mongodb-unit-of-work";

type InsertOneOptions = Parameters<
  Collection<MongodbEventModel>["insertOne"]
>[1];
type InsertOneSession = NonNullable<InsertOneOptions>["session"];
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

class FakeClientSession {
  readonly calls: string[] = [];

  startTransaction(): void {
    this.calls.push("startTransaction");
  }

  commitTransaction(): Promise<void> {
    this.calls.push("commitTransaction");
    return Promise.resolve();
  }

  abortTransaction(): Promise<void> {
    this.calls.push("abortTransaction");
    return Promise.resolve();
  }

  endSession(): Promise<void> {
    this.calls.push("endSession");
    return Promise.resolve();
  }
}

class FakeMongoClient {
  readonly collection = new FakeCollection();
  readonly session = new FakeClientSession();
  startedSessions = 0;

  startSession(): FakeClientSession {
    this.startedSessions += 1;
    return this.session;
  }

  db(): {
    collection: (collectionName: string) => FakeCollection;
  } {
    return {
      collection: () => this.collection,
    };
  }
}

const event = Event.restore({
  tenant: "organization:org1",
  metadata: {
    createdAt: new Date("2026-01-02T00:00:00Z"),
    updatedAt: new Date("2026-01-03T00:00:00Z"),
  },
  payload: {
    id: "01952d3f-0000-7000-8000-000000000000",
    external: {
      id: "jira-123",
      provider: "jira",
    },
    graphId: "01952d3f-0000-7000-8000-000000000100",
    raw: {
      issue: { key: "REC-123", summary: "hello" },
    },
  },
});

test("MongodbUnitOfWork.transaction: given successful work, it should commit and end the MongoDB session", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const uow = new MongodbUnitOfWork(
    client as unknown as MongoClient,
    "recallos",
  );
  const session = client.session as unknown as InsertOneSession;

  // WHEN
  const result = await uow.transaction(async ({ eventRepository }) => {
    await eventRepository.insert(event);
    return "ok";
  });

  // THEN
  expect(result).toBe("ok");
  expect(client.startedSessions).toBe(1);
  expect(client.session.calls).toEqual([
    "startTransaction",
    "commitTransaction",
    "endSession",
  ]);
  expect(client.collection.insertOneCalls[0]!.options?.session).toBe(session);
});

test("MongodbUnitOfWork.transaction: given failing work, it should abort, end the MongoDB session, and rethrow", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const uow = new MongodbUnitOfWork(
    client as unknown as MongoClient,
    "recallos",
  );
  const thrown = new Error("boom");

  // WHEN
  const error = await uow
    .transaction(() => Promise.reject(thrown))
    .catch((caught: unknown) => caught);

  // THEN
  expect(error).toBe(thrown);
  expect(client.startedSessions).toBe(1);
  expect(client.session.calls).toEqual([
    "startTransaction",
    "abortTransaction",
    "endSession",
  ]);
  expect(client.collection.insertOneCalls.length).toBe(0);
});
