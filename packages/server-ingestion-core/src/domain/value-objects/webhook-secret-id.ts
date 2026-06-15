import { Id } from "@repo/server-kernel";

type RestoreWebhookSecretIdInput = {
  payload: string;
};

class WebhookSecretId extends Id {
  static create() {
    return new WebhookSecretId(Id.newValue());
  }
  static restore(input: RestoreWebhookSecretIdInput) {
    return new WebhookSecretId(input.payload);
  }
}

export { WebhookSecretId };
