import { Id } from "@repo/server-kernel";

type RestoreWebhookSubscriptionContextIdInput = {
  payload: string;
};

class WebhookSubscriptionContextId extends Id {
  static create() {
    return new WebhookSubscriptionContextId(Id.newValue());
  }
  static restore(input: RestoreWebhookSubscriptionContextIdInput) {
    return new WebhookSubscriptionContextId(input.payload);
  }
}

export { WebhookSubscriptionContextId };
