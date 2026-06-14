import { Tenant } from "@repo/server-kernel";

import type {
  GetWebhookSubscriptionPort,
  GetWebhookSubscriptionPortInput,
  GetWebhookSubscriptionPortOutput,
} from "../ports/inbound/get-webhook-subscription-port.ts";
import type { WebhookSubscriptionRepositoryPort } from "../ports/outbound/webhook-subscription-repository-port.ts";

import { createWebhookSubscriptionNotFoundError } from "../../domain/errors/webhook-subscription-not-found-error.ts";
import { WebhookSubscriptionId } from "../../domain/value-objects/webhook-subscription-id.ts";

class GetWebhookSubscriptionUseCase implements GetWebhookSubscriptionPort {
  constructor(
    private readonly webhookSubscriptionRepository: WebhookSubscriptionRepositoryPort,
  ) {}

  async execute(
    input: GetWebhookSubscriptionPortInput,
  ): GetWebhookSubscriptionPortOutput {
    const id = WebhookSubscriptionId.restore({ payload: input.id });
    const tenant = Tenant.fromString(input.tenant);

    const webhookSubscription =
      await this.webhookSubscriptionRepository.findById({
        id,
        tenant,
      });

    if (webhookSubscription === null) {
      throw createWebhookSubscriptionNotFoundError(
        "Webhook subscription not found",
        {
          id: input.id,
          tenant: input.tenant,
        },
      );
    }

    return {
      id: webhookSubscription.id.toString(),
      tenant: webhookSubscription.tenant.toString(),
      createdAt: webhookSubscription.metadata.createdAt,
      updatedAt: webhookSubscription.metadata.updatedAt,
      provider: webhookSubscription.provider,
      secret: {
        id: webhookSubscription.secret.id.toString(),
        createdAt: webhookSubscription.secret.metadata.createdAt,
        updatedAt: webhookSubscription.secret.metadata.updatedAt,
        algorithm: webhookSubscription.secret.algorithm,
      },
    };
  }
}

export { GetWebhookSubscriptionUseCase };
