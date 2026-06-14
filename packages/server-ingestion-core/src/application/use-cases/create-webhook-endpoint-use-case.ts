import { type Clock } from "@repo/server-kernel";

import type {
  CreateWebhookSubscriptionPort,
  CreateWebhookSubscriptionPortInput,
  CreateWebhookSubscriptionPortOutput,
} from "../ports/inbound/create-webhook-subscription-port.ts";
import type { UnitOfWorkPort } from "../ports/outbound/unit-of-work-port.ts";
import type { WebhookSecretGeneratorPort } from "../ports/outbound/webhook-secret-generator-port.ts";

import { WebhookSubscription } from "../../domain/aggregates/webhook-subscription.ts";

class CreateWebhookSubscriptionUseCase implements CreateWebhookSubscriptionPort {
  constructor(
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly webhookSecretGenerator: WebhookSecretGeneratorPort,
  ) {}

  async execute(
    input: CreateWebhookSubscriptionPortInput,
  ): CreateWebhookSubscriptionPortOutput {
    const now = this.clock.now();

    const webhookSubscription = WebhookSubscription.create({
      tenant: input.tenant,
      metadata: { now },
      payload: {
        provider: input.payload.provider,
        secret: {
          algorithm: input.payload.secret.algorithm,
          generate: () => this.webhookSecretGenerator.generate(),
        },
      },
    });

    await this.unitOfWork.transaction(({ webhookSubscriptionRepository }) => {
      return webhookSubscriptionRepository.insert({
        data: webhookSubscription,
      });
    });

    return {
      id: webhookSubscription.id.toString(),
      secret: {
        algorithm: webhookSubscription.secret.algorithm,
        value: webhookSubscription.secret.value,
      },
    };
  }
}

export { CreateWebhookSubscriptionUseCase };
