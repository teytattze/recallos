import type { Collection, MongoClient } from "mongodb";

import {
  WebhookSubscription,
  type WebhookSubscriptionRepositoryPort,
  type WebhookSubscriptionRepositoryPortFindByIdInput,
  type WebhookSubscriptionRepositoryPortFindByIdOutput,
  type WebhookSubscriptionRepositoryPortInsertInput,
  type WebhookSubscriptionRepositoryPortInsertOutput,
} from "@repo/server-ingestion-core";

import type { MongodbWebhookSubscriptionModel } from "./mongodb-webhook-subscription-model.ts";

const COLLECTION_NAME = "webhook-subscriptions" as const;

class MongodbWebhookSubscriptionRepository implements WebhookSubscriptionRepositoryPort {
  constructor(
    private readonly client: MongoClient,
    private readonly databaseName: string,
  ) {}

  async findById(
    input: WebhookSubscriptionRepositoryPortFindByIdInput,
  ): WebhookSubscriptionRepositoryPortFindByIdOutput {
    const model = await this.collection.findOne({
      _id: input.id.toString(),
      tenant: input.tenant.toString(),
    });

    return model === null
      ? null
      : WebhookSubscription.restore({
          tenant: model.tenant,
          metadata: { createdAt: model.createdAt, updatedAt: model.updatedAt },
          payload: {
            id: model._id,
            provider: model.provider,
            secret: {
              metadata: {
                createdAt: model.createdAt,
                updatedAt: model.updatedAt,
              },
              payload: {
                id: model.secret._id,
                algorithm: model.secret.algorithm,
                value: model.secret.value,
              },
            },
          },
        });
  }

  async insert(
    input: WebhookSubscriptionRepositoryPortInsertInput,
  ): WebhookSubscriptionRepositoryPortInsertOutput {
    const model = {
      _id: input.data.id.toString(),
      createdAt: input.data.metadata.createdAt,
      updatedAt: input.data.metadata.updatedAt,
      tenant: input.data.tenant.toString(),

      provider: input.data.provider,
      secret: {
        _id: input.data.secret.id.toString(),
        createdAt: input.data.secret.metadata.createdAt,
        updatedAt: input.data.secret.metadata.updatedAt,

        algorithm: input.data.secret.algorithm,
        value: input.data.secret.value,
      },
    } as const satisfies MongodbWebhookSubscriptionModel;

    await this.collection.insertOne(model);
  }

  private get collection(): Collection<MongodbWebhookSubscriptionModel> {
    return this.client
      .db(this.databaseName)
      .collection<MongodbWebhookSubscriptionModel>(COLLECTION_NAME);
  }
}

export { MongodbWebhookSubscriptionRepository as MongodbWebhookEndpointRepository };
