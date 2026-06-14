import { defineError } from "@repo/server-kernel";

const createInvalidWebhookAuthenticationError = defineError(
  "InvalidWebhookAuthentication",
  "forbidden",
);
type InvalidWebhookAuthenticationError = ReturnType<
  typeof createInvalidWebhookAuthenticationError
>;

export { createInvalidWebhookAuthenticationError };
export type { InvalidWebhookAuthenticationError };
