import type { IngestEventPort } from "@repo/server-ingestion-core";

import { Hono, type Context } from "hono";

import {
  jiraWebhookEventQueryParams,
  jiraWebhookEventRequestBody,
} from "../dtos/jira-webhook-dtos";

type JiraWebhookRoutesInput = {
  deps: {
    ingestEvent: IngestEventPort;
  };
};

const createJiraWebhookRoutes = (input: JiraWebhookRoutesInput) => {
  const jiraWebhookRoutes = new Hono();

  jiraWebhookRoutes.post("/events", async (c: Context) => {
    const body = jiraWebhookEventRequestBody.parse(await c.req.json());
    const queryParams = jiraWebhookEventQueryParams.parse({
      graphId: c.req.query("graphId"),
      tenant: c.req.query("tenant"),
    });

    await input.deps.ingestEvent.execute({
      tenant: queryParams.tenant,
      payload: {
        external: { id: "", provider: "jira" },
        graphId: queryParams.graphId,
        raw: body,
      },
    });

    return c.body(null, 201);
  });

  return jiraWebhookRoutes;
};

export { createJiraWebhookRoutes };
