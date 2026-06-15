import type { Collection, ClientSession, MongoClient } from "mongodb";

import { WebhookSubscription } from "@repo/server-ingestion-core";
import { test, expect } from "bun:test";

import type { MongodbWebhookSubscriptionModel } from "./mongodb-webhook-subscription-model";

import { MongodbWebhookSubscriptionRepository } from "./mongodb-webhook-subscription-repository";

type InsertOneOptions = Parameters<
  Collection<MongodbWebhookSubscriptionModel>["insertOne"]
>[1];
type FindOneFilter = Parameters<
  Collection<MongodbWebhookSubscriptionModel>["findOne"]
>[0];
type InsertCall = {
  model: MongodbWebhookSubscriptionModel;
  options: InsertOneOptions;
};

class FakeCollection {
  readonly insertOneCalls: InsertCall[] = [];
  readonly findOneCalls: FindOneFilter[] = [];

  constructor(private readonly found: MongodbWebhookSubscriptionModel | null) {}

  insertOne(
    model: MongodbWebhookSubscriptionModel,
    options: InsertOneOptions,
  ): Promise<void> {
    this.insertOneCalls.push({ model, options });
    return Promise.resolve();
  }

  findOne(
    filter: FindOneFilter,
  ): Promise<MongodbWebhookSubscriptionModel | null> {
    this.findOneCalls.push(filter);
    return Promise.resolve(this.found);
  }
}

class FakeMongoClient {
  readonly collection: FakeCollection;
  databaseName?: string;
  collectionName?: string;

  constructor(found: MongodbWebhookSubscriptionModel | null = null) {
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

const id = "webhook-subscription-1";
const createdAt = new Date("2026-01-02T00:00:00Z");
const updatedAt = new Date("2026-01-03T00:00:00Z");
const tenant = "organization:org1";
const graphId = "graph-1";
const contextId = "webhook-subscription-context-1";
const contextCreatedAt = new Date("2026-01-06T00:00:00Z");
const contextUpdatedAt = new Date("2026-01-07T00:00:00Z");
const secretId = "webhook-secret-1";
const secretCreatedAt = new Date("2026-01-04T00:00:00Z");
const secretUpdatedAt = new Date("2026-01-05T00:00:00Z");
const storedSecretValue = "stored-secret-value";

const storedModel = {
  _id: id,
  createdAt,
  updatedAt,
  tenant,
  provider: "jira",
  context: {
    _id: contextId,
    createdAt: contextCreatedAt,
    updatedAt: contextUpdatedAt,
    graphId,
  },
  secret: {
    _id: secretId,
    createdAt: secretCreatedAt,
    updatedAt: secretUpdatedAt,
    algorithm: "hmac_sha256",
    value: storedSecretValue,
  },
} satisfies MongodbWebhookSubscriptionModel;

test("MongodbWebhookSubscriptionRepository.insert: given a subscription, it should insert the MongoDB model with context and session", async () => {
  // GIVEN
  const client = new FakeMongoClient();
  const session = { id: "session-1" } as unknown as ClientSession;
  const repository = new MongodbWebhookSubscriptionRepository(
    client as unknown as MongoClient,
    "recallos",
    session,
  );
  const subscription = WebhookSubscription.restore({
    tenant,
    metadata: { createdAt, updatedAt },
    payload: {
      id,
      provider: "jira",
      context: {
        metadata: {
          createdAt: contextCreatedAt,
          updatedAt: contextUpdatedAt,
        },
        payload: { id: contextId, graphId },
      },
      secret: {
        metadata: {
          createdAt: secretCreatedAt,
          updatedAt: secretUpdatedAt,
        },
        payload: {
          id: secretId,
          algorithm: "hmac_sha256",
          value: storedSecretValue,
        },
      },
    },
  });

  // WHEN
  await repository.insert({ data: subscription });

  // THEN
  expect(client.databaseName).toBe("recallos");
  expect(client.collectionName).toBe("webhook-subscriptions");
  expect(client.collection.insertOneCalls).toEqual([
    {
      model: storedModel,
      options: {
        session,
      },
    },
  ]);
});

test("MongodbWebhookSubscriptionRepository.findById: given a stored subscription, it should restore the aggregate", async () => {
  // GIVEN
  const client = new FakeMongoClient(storedModel);
  const repository = new MongodbWebhookSubscriptionRepository(
    client as unknown as MongoClient,
    "recallos",
  );
  const storedSubscription = WebhookSubscription.restore({
    tenant,
    metadata: { createdAt, updatedAt },
    payload: {
      id,
      provider: "jira",
      context: {
        metadata: {
          createdAt: contextCreatedAt,
          updatedAt: contextUpdatedAt,
        },
        payload: { id: contextId, graphId },
      },
      secret: {
        metadata: {
          createdAt: secretCreatedAt,
          updatedAt: secretUpdatedAt,
        },
        payload: {
          id: secretId,
          algorithm: "hmac_sha256",
          value: storedSecretValue,
        },
      },
    },
  });

  // WHEN
  const subscription = await repository.findById({
    id: storedSubscription.id,
    tenant: storedSubscription.tenant,
  });

  // THEN
  expect(client.collection.findOneCalls).toEqual([{ _id: id, tenant }]);
  expect(subscription?.id.toString()).toBe(id);
  expect(subscription?.tenant.toString()).toBe(tenant);
  expect(subscription?.metadata.createdAt).toEqual(createdAt);
  expect(subscription?.metadata.updatedAt).toEqual(updatedAt);
  expect(subscription?.provider).toBe("jira");
  expect(subscription?.context.id.toString()).toBe(contextId);
  expect(subscription?.context.metadata.createdAt).toEqual(contextCreatedAt);
  expect(subscription?.context.metadata.updatedAt).toEqual(contextUpdatedAt);
  expect(subscription?.context.graphId.toString()).toBe(graphId);
  expect(subscription?.secret.id.toString()).toBe(secretId);
  expect(subscription?.secret.algorithm).toBe("hmac_sha256");
  expect(subscription?.secret.value).toBe(storedSecretValue);
});
