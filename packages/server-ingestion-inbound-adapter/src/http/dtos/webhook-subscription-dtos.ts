import { z } from "zod";

const webhookSubscriptionRequestBodySchema = z.object({
  provider: z.enum(["jira"]),
  secret: z.object({
    algorithm: z.enum(["hmac_sha256"]),
  }),
});

const webhookSubscriptionQueryParams = z.object({
  tenant: z.string(),
});

export { webhookSubscriptionRequestBodySchema, webhookSubscriptionQueryParams };
