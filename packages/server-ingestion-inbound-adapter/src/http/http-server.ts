import { Hono } from "hono";

type CreateIngestionHttpAppInput = {
  deps: {
    jiraWebhookRoutes: Hono;
  };
};

const createIngestionHttpApp = (input: CreateIngestionHttpAppInput) => {
  const app = new Hono();

  app.route("/api/v1/external-providers/jira", input.deps.jiraWebhookRoutes);

  return app;
};

export { createIngestionHttpApp };
