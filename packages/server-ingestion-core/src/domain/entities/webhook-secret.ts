import { Entity, EntityMetadata, parseProps } from "@repo/server-kernel";
import { z } from "zod";

import { WebhookSecretId } from "../value-objects/webhook-secret-id";

const webhookSecretPropsSchema = z.object({
  algorithm: z.enum(["hmac_sha256"]).brand<"WebhookSecretAlgorithm">(),
  value: z.string().brand<"WebhookSecretValue">(),
});

type WebhookSecretPropsIn = z.input<typeof webhookSecretPropsSchema>;
type WebhookSecretProps = z.output<typeof webhookSecretPropsSchema>;

type CreateWebhookSecretInput = {
  metadata: {
    now: Date;
  };
  payload: Omit<WebhookSecretPropsIn, "value"> & {
    generate: () => string;
  };
};
type RestoreWebhookSecretInput = {
  metadata: {
    createdAt: Date;
    updatedAt: Date;
  };
  payload: WebhookSecretPropsIn & {
    id: string;
  };
};

class WebhookSecret extends Entity<WebhookSecretId, WebhookSecretProps> {
  static create(input: CreateWebhookSecretInput) {
    return new WebhookSecret(
      WebhookSecretId.create(),
      EntityMetadata.create({ payload: input.metadata }),
      parseProps(webhookSecretPropsSchema, {
        algorithm: input.payload.algorithm,
        value: input.payload.generate(),
      }),
    );
  }

  static restore(input: RestoreWebhookSecretInput) {
    return new WebhookSecret(
      WebhookSecretId.restore({ payload: input.payload.id }),
      EntityMetadata.restore({ payload: input.metadata }),
      parseProps(webhookSecretPropsSchema, {
        algorithm: input.payload.algorithm,
        value: input.payload.value,
      }),
    );
  }

  get algorithm(): WebhookSecretProps["algorithm"] {
    return this._props.algorithm;
  }
  get value(): WebhookSecretProps["value"] {
    return this._props.value;
  }
}

export { WebhookSecret };
export type { CreateWebhookSecretInput, RestoreWebhookSecretInput };
