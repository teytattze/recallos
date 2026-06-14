import type { JsonObject } from "type-fest";

import { z } from "zod";

const jiraWebhookEventRequestBody = z.custom<JsonObject>(
  (data) => z.json().safeParse(data).success,
);

const jiraWebhookEventQueryParams = z.object({
  tenant: z.string(),
  subscriptionId: z.string(),
});

export { jiraWebhookEventRequestBody, jiraWebhookEventQueryParams };
