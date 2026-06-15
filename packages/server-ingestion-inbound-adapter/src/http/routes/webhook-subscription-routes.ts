import type { CreateWebhookSubscriptionPort } from "@repo/server-ingestion-core";

import { Hono, type Context } from "hono";

import {
  webhookSubscriptionQueryParams,
  webhookSubscriptionRequestBodySchema,
} from "../dtos/webhook-subscription-dtos";

type WebhookSubscriptionRoutesInput = {
  deps: {
    createWebhookSubscription: CreateWebhookSubscriptionPort;
  };
};

const createWebhookSubscriptionRoutes = (
  input: WebhookSubscriptionRoutesInput,
) => {
  const webhookSubscriptionRoutes = new Hono();

  webhookSubscriptionRoutes.post(
    "/webhook-subscriptions",
    async (c: Context) => {
      const body = webhookSubscriptionRequestBodySchema.parse(
        await c.req.json(),
      );
      const queryParams = webhookSubscriptionQueryParams.parse({
        tenant: c.req.query("tenant"),
      });

      const ret = await input.deps.createWebhookSubscription.execute({
        tenant: queryParams.tenant,
        payload: {
          provider: "jira",
          context: { graphId: body.context.graphId },
          secret: { algorithm: body.secret.algorithm },
        },
      });

      return c.json({ secret: ret.secret }, 201);
    },
  );

  return webhookSubscriptionRoutes;
};

export { createWebhookSubscriptionRoutes };
