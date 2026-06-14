import { Id } from "@repo/server-kernel";

type RestoreWebhookSubscriptionIdInput = {
  payload: string;
};

class WebhookSubscriptionId extends Id {
  static create() {
    return new WebhookSubscriptionId(Id.newValue());
  }
  static restore(input: RestoreWebhookSubscriptionIdInput) {
    return new WebhookSubscriptionId(input.payload);
  }
}

export { WebhookSubscriptionId };
