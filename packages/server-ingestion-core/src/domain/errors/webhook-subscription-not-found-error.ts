import { defineError } from "@repo/server-kernel";

const createWebhookSubscriptionNotFoundError = defineError(
  "WebhookSubscriptionNotFound",
  "not-found",
);
type WebhookSubscriptionNotFoundError = ReturnType<
  typeof createWebhookSubscriptionNotFoundError
>;

export { createWebhookSubscriptionNotFoundError };
export type { WebhookSubscriptionNotFoundError };
