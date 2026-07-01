import { AppError } from "@repo/app-error";
import { Tenant } from "@repo/server-kernel";

import type {
  GetWebhookSubscriptionPort,
  GetWebhookSubscriptionPortInput,
  GetWebhookSubscriptionPortOutput,
} from "../ports/inbound/get-webhook-subscription-port.ts";
import type { WebhookSubscriptionRepositoryPort } from "../ports/outbound/webhook-subscription-repository-port.ts";

import { WebhookSubscriptionId } from "../../domain/value-objects/webhook-subscription-id.ts";

class GetWebhookSubscriptionUseCase implements GetWebhookSubscriptionPort {
  constructor(
    private readonly webhookSubscriptionRepository: WebhookSubscriptionRepositoryPort,
  ) {}

  async execute(
    input: GetWebhookSubscriptionPortInput,
  ): GetWebhookSubscriptionPortOutput {
    const id = WebhookSubscriptionId.restore({ payload: input.payload.id });
    const tenant = Tenant.fromString(input.tenant);

    const webhookSubscription =
      await this.webhookSubscriptionRepository.findById({
        id,
        tenant,
      });

    if (webhookSubscription === null) {
      throw AppError.ofCode("serverIngestionCore.webhookSubscriptionNotFound");
    }

    return {
      id: webhookSubscription.id.toString(),
      tenant: webhookSubscription.tenant.toString(),
      createdAt: webhookSubscription.metadata.createdAt,
      updatedAt: webhookSubscription.metadata.updatedAt,
      provider: webhookSubscription.provider,
      context: {
        id: webhookSubscription.context.id.toString(),
        createdAt: webhookSubscription.context.metadata.createdAt,
        updatedAt: webhookSubscription.context.metadata.updatedAt,
        graphId: webhookSubscription.context.graphId.toString(),
      },
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
