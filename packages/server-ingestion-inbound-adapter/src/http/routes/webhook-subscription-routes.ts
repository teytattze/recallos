import type { CreateWebhookSubscriptionPort } from "@repo/server-ingestion-core";

import { Hono, type Context } from "hono";

import { webhookSubscriptionRequestBodySchema } from "../dtos/webhook-subscription-dtos";

type ResolveTenant = (c: Context) => string;

type WebhookSubscriptionRoutesInput = {
  deps: {
    createWebhookSubscription: CreateWebhookSubscriptionPort;
  };
  resolveTenant: ResolveTenant;
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

      const ret = await input.deps.createWebhookSubscription.execute({
        tenant: input.resolveTenant(c),
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
