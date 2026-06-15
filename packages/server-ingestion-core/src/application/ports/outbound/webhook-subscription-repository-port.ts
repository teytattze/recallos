import type { Tenant } from "@repo/server-kernel";

import type { WebhookSubscription } from "../../../domain/aggregates/webhook-subscription.ts";
import type { WebhookSubscriptionId } from "../../../domain/value-objects/webhook-subscription-id.ts";

type WebhookSubscriptionRepositoryPortFindByIdInput = {
  id: WebhookSubscriptionId;
  tenant: Tenant;
};
type WebhookSubscriptionRepositoryPortFindByIdOutput =
  Promise<WebhookSubscription | null>;

type WebhookSubscriptionRepositoryPortInsertInput = {
  data: WebhookSubscription;
};
type WebhookSubscriptionRepositoryPortInsertOutput = Promise<void>;

interface WebhookSubscriptionRepositoryPort {
  findById(
    input: WebhookSubscriptionRepositoryPortFindByIdInput,
  ): WebhookSubscriptionRepositoryPortFindByIdOutput;
  insert(
    input: WebhookSubscriptionRepositoryPortInsertInput,
  ): WebhookSubscriptionRepositoryPortInsertOutput;
}

export type {
  WebhookSubscriptionRepositoryPort,
  WebhookSubscriptionRepositoryPortFindByIdInput,
  WebhookSubscriptionRepositoryPortFindByIdOutput,
  WebhookSubscriptionRepositoryPortInsertInput,
  WebhookSubscriptionRepositoryPortInsertOutput,
};
