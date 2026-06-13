import type { IngestEventUseCase } from "@repo/server-ingestion-core";

import { Tenant } from "@repo/server-kernel";
import { Hono, type Context } from "hono";

import {
  jiraWebhookEventQueryParams,
  jiraWebhookEventRequestBody,
} from "../dtos/jira-webhook-dtos";

type JiraWebhookRoutesInput = {
  deps: {
    ingestEventUseCase: IngestEventUseCase;
  };
};

const makeJiraWebhookRoutes = (input: JiraWebhookRoutesInput) => {
  const jiraWebhookRoutes = new Hono();

  jiraWebhookRoutes.post("/events", async (c: Context) => {
    const body = jiraWebhookEventRequestBody.parse(c.req.json());
    const queryParams = jiraWebhookEventQueryParams.parse({
      graphId: c.req.query("graphId"),
      tenant: c.req.query("tenant"),
    });

    await input.deps.ingestEventUseCase.execute({
      tenant: Tenant.fromString(queryParams.tenant),
      payload: {
        external: { id: "", provider: "jira" },
        graphId: queryParams.graphId,
        raw: body,
      },
    });

    return c.status(201);
  });

  return jiraWebhookRoutes;
};

export { makeJiraWebhookRoutes };
