import {
  EntityMetadata,
  parseProps,
  Tenant,
  TenantAwareAggregateRoot,
} from "@repo/server-kernel";
import { z } from "zod";

import {
  WebhookSecret,
  type CreateWebhookSecretInput,
  type RestoreWebhookSecretInput,
} from "../entities/webhook-secret";
import { WebhookSubscriptionId } from "../value-objects/webhook-subscription-id";

const webhookSubscriptionPropsSchema = z.object({
  provider: z.enum(["jira"]).brand<"WebhookSubscriptionProvider">(),
  secret: z.custom<WebhookSecret>((v) => v instanceof WebhookSecret),
});

type WebhookSubscriptionPropsIn = z.input<
  typeof webhookSubscriptionPropsSchema
>;
type WebhookSubscriptionProps = z.output<typeof webhookSubscriptionPropsSchema>;

type CreateWebhookSubscriptionInput = {
  tenant: string;
  metadata: { now: Date };
  payload: Omit<WebhookSubscriptionPropsIn, "secret"> & {
    secret: CreateWebhookSecretInput["payload"];
  };
};

type RestoreWebhookSubscriptionInput = {
  tenant: string;
  metadata: { createdAt: Date; updatedAt: Date };
  payload: Omit<WebhookSubscriptionPropsIn, "secret"> & {
    id: string;
    secret: RestoreWebhookSecretInput;
  };
};

class WebhookSubscription extends TenantAwareAggregateRoot<
  WebhookSubscriptionId,
  WebhookSubscriptionProps
> {
  static create(input: CreateWebhookSubscriptionInput) {
    return new WebhookSubscription(
      WebhookSubscriptionId.create(),
      Tenant.fromString(input.tenant),
      EntityMetadata.create({ payload: input.metadata }),
      parseProps(webhookSubscriptionPropsSchema, {
        provider: input.payload.provider,
        secret: WebhookSecret.create({
          metadata: input.metadata,
          payload: input.payload.secret,
        }),
      }),
    );
  }

  static restore(input: RestoreWebhookSubscriptionInput) {
    return new WebhookSubscription(
      WebhookSubscriptionId.restore({ payload: input.payload.id }),
      Tenant.fromString(input.tenant),
      EntityMetadata.restore({ payload: input.metadata }),
      parseProps(webhookSubscriptionPropsSchema, {
        provider: input.payload.provider,
        secret: WebhookSecret.restore(input.payload.secret),
      }),
    );
  }

  get provider(): WebhookSubscriptionProps["provider"] {
    return this._props.provider;
  }
  get secret(): WebhookSubscriptionProps["secret"] {
    return this._props.secret;
  }
}

export { WebhookSubscription };
