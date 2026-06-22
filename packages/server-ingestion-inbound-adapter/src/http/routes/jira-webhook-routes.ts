import type {
  AuthenticateWebhookRequestPort,
  GetWebhookSubscriptionPort,
  IngestEventPort,
} from "@repo/server-ingestion-core";

import { Hono, type Context } from "hono";

import {
  jiraWebhookEventQueryParams,
  jiraWebhookEventRequestBody,
} from "../dtos/jira-webhook-dtos";

type JiraWebhookRoutesInput = {
  deps: {
    authenticateWebhookRequest: AuthenticateWebhookRequestPort;
    ingestEvent: IngestEventPort;
    getWebhookSubscription: GetWebhookSubscriptionPort;
  };
};

const createJiraWebhookRoutes = (input: JiraWebhookRoutesInput) => {
  const jiraWebhookRoutes = new Hono();

  jiraWebhookRoutes.post("/events", async (c: Context) => {
    const body = jiraWebhookEventRequestBody.parse(await c.req.json());
    const queryParams = jiraWebhookEventQueryParams.parse({
      subscriptionId: c.req.query("subscriptionId"),
      tenant: c.req.query("tenant"),
    });
    const signature = c.req.header("X-Hub-Signature")?.replace("sha256=", "");

    if (signature !== undefined) {
      await input.deps.authenticateWebhookRequest.execute({
        tenant: queryParams.tenant,
        payload: {
          id: queryParams.subscriptionId,
          provider: "jira",
          incomingSignature: signature,
          incomingBody: JSON.stringify(body),
        },
      });
    }

    const webhookSubscription = await input.deps.getWebhookSubscription.execute(
      {
        tenant: queryParams.tenant,
        payload: { id: queryParams.subscriptionId },
      },
    );

    const event = await input.deps.ingestEvent.execute({
      tenant: queryParams.tenant,
      payload: {
        external: { id: "", provider: "jira" },
        graphId: webhookSubscription.context.graphId,
        raw: body,
      },
    });

    return c.json({ id: event.id }, 201);
  });

  return jiraWebhookRoutes;
};

export { createJiraWebhookRoutes };
