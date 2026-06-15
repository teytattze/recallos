import type { Collection, MongoClient } from "mongodb";

import { Event, WebhookSubscription } from "@repo/server-ingestion-core";
import { test, expect } from "bun:test";

import type { MongodbEventModel } from "./mongodb-event-model";
import type { MongodbWebhookSubscriptionModel } from "./mongodb-webhook-subscription-model";

import { MongodbUnitOfWork } from "./mongodb-unit-of-work";

type EventInsertOneOptions = Parameters<
  Collection<MongodbEventModel>["insertOne"]
>[1];
type WebhookSubscriptionInsertOneOptions = Parameters<
  Collection<MongodbWebhookSubscriptionModel>["insertOne"]
>[1];
type InsertOneSession = NonNullable<EventInsertOneOptions>["session"];
type InsertCall<TModel, TOptions> = {
  model: TModel;
  options: TOptions;
};

class FakeCollection<TModel, TOptions> {
  readonly insertOneCalls: InsertCall<TModel, TOptions>[] = [];

  insertOne(model: TModel, options: TOptions): Promise<void> {
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
  readonly eventCollection = new FakeCollection<
    MongodbEventModel,
    EventInsertOneOptions
  >();
  readonly webhookSubscriptionCollection = new FakeCollection<
    MongodbWebhookSubscriptionModel,
    WebhookSubscriptionInsertOneOptions
  >();
  readonly session = new FakeClientSession();
  startedSessions = 0;

  startSession(): FakeClientSession {
    this.startedSessions += 1;
    return this.session;
  }

  db(): {
    collection: (
      collectionName: string,
    ) =>
      | FakeCollection<MongodbEventModel, EventInsertOneOptions>
      | FakeCollection<
          MongodbWebhookSubscriptionModel,
          WebhookSubscriptionInsertOneOptions
        >;
  } {
    return {
      collection: (collectionName) => {
        if (collectionName === "events") return this.eventCollection;
        if (collectionName === "webhook-subscriptions") {
          return this.webhookSubscriptionCollection;
        }
        throw new Error(`Unexpected collection: ${collectionName}`);
      },
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

const webhookSubscription = WebhookSubscription.restore({
  tenant: "organization:org1",
  metadata: {
    createdAt: new Date("2026-01-04T00:00:00Z"),
    updatedAt: new Date("2026-01-05T00:00:00Z"),
  },
  payload: {
    id: "webhook-subscription-1",
    provider: "jira",
    context: {
      metadata: {
        createdAt: new Date("2026-01-06T00:00:00Z"),
        updatedAt: new Date("2026-01-07T00:00:00Z"),
      },
      payload: {
        id: "webhook-subscription-context-1",
        graphId: "01952d3f-0000-7000-8000-000000000100",
      },
    },
    secret: {
      metadata: {
        createdAt: new Date("2026-01-08T00:00:00Z"),
        updatedAt: new Date("2026-01-09T00:00:00Z"),
      },
      payload: {
        id: "webhook-secret-1",
        algorithm: "hmac_sha256",
        value: "stored-secret-value",
      },
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
  const result = await uow.transaction(
    async ({ eventRepository, webhookSubscriptionRepository }) => {
      await eventRepository.insert({ data: event });
      await webhookSubscriptionRepository.insert({ data: webhookSubscription });
      return "ok";
    },
  );

  // THEN
  expect(result).toBe("ok");
  expect(client.startedSessions).toBe(1);
  expect(client.session.calls).toEqual([
    "startTransaction",
    "commitTransaction",
    "endSession",
  ]);
  expect(client.eventCollection.insertOneCalls[0]!.options?.session).toBe(
    session,
  );
  expect(
    client.webhookSubscriptionCollection.insertOneCalls[0]!.options?.session,
  ).toBe(session);
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
  expect(client.eventCollection.insertOneCalls.length).toBe(0);
  expect(client.webhookSubscriptionCollection.insertOneCalls.length).toBe(0);
});
