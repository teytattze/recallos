import { z } from "zod";

const webhookSubscriptionRequestBodySchema = z.object({
  provider: z.enum(["jira"]),
  context: z.object({
    graphId: z.string(),
  }),
  secret: z.object({
    algorithm: z.enum(["hmac_sha256"]),
  }),
});

export { webhookSubscriptionRequestBodySchema };
