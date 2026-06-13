import { Hono } from "hono";

type CreateHonoAppInput = {
  deps: {
    jiraWebhookRoutes: Hono;
  };
};

const createHonoApp = (input: CreateHonoAppInput) => {
  const app = new Hono();

  app.route("/api/v1/external-providers/jira", input.deps.jiraWebhookRoutes);

  return app;
};

export { createHonoApp };
