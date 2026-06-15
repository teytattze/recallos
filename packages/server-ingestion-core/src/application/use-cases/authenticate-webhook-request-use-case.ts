import { Tenant } from "@repo/server-kernel";
import { timingSafeEqual } from "node:crypto";

import type {
  AuthenticateWebhookRequestPort,
  AuthenticateWebhookRequestPortInput,
  AuthenticateWebhookRequestPortOutput,
} from "../ports/inbound/authenticate-webhook-request-port.ts";
import type { WebhookSignatureGeneratorPort } from "../ports/outbound/webhook-signature-generator-port.ts";
import type { WebhookSubscriptionRepositoryPort } from "../ports/outbound/webhook-subscription-repository-port.ts";

import { createInvalidWebhookAuthenticationError } from "../../domain/errors/invalid-webhook-authentication-error.ts";
import { WebhookSubscriptionId } from "../../domain/value-objects/webhook-subscription-id.ts";

class AuthenticateWebhookRequestUseCase implements AuthenticateWebhookRequestPort {
  constructor(
    private readonly webhookSubscriptionRepository: WebhookSubscriptionRepositoryPort,
    private readonly webhookSignatureGenerator: WebhookSignatureGeneratorPort,
  ) {}

  async execute(
    input: AuthenticateWebhookRequestPortInput,
  ): AuthenticateWebhookRequestPortOutput {
    const tenant = Tenant.fromString(input.tenant);
    const webhookSubscriptionId = WebhookSubscriptionId.restore({
      payload: input.payload.id,
    });

    const webhookSubscription =
      await this.webhookSubscriptionRepository.findById({
        id: webhookSubscriptionId,
        tenant,
      });

    if (webhookSubscription === null) {
      throw createInvalidWebhookAuthenticationError(
        "Webhook authentication failed",
      );
    }
    const expectedSignature = this.webhookSignatureGenerator.generate({
      secret: webhookSubscription.secret,
      payload: input.payload.incomingBody,
    });
    const isValid = timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(input.payload.incomingSignature),
    );

    if (isValid) {
      return;
    }
    throw createInvalidWebhookAuthenticationError(
      "Webhook authentication failed",
    );
  }
}

export { AuthenticateWebhookRequestUseCase };
