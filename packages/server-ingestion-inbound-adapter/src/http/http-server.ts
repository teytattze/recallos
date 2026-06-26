import { Hono, type MiddlewareHandler } from "hono";

type CreateIngestionHttpAppInput = {
  deps: {
    jiraWebhookRoutes: Hono;
    webhookSubscriptionRoutes?: Hono;
    webhookSubscriptionMiddlewares?: readonly MiddlewareHandler[];
  };
};

const createIngestionHttpApp = (input: CreateIngestionHttpAppInput) => {
  const app = new Hono();

  app.route("/api/v1/external-providers/jira", input.deps.jiraWebhookRoutes);

  if (input.deps.webhookSubscriptionRoutes !== undefined) {
    for (const middleware of input.deps.webhookSubscriptionMiddlewares ?? []) {
      app.use("/api/v1/ingestion/*", middleware);
    }

    app.route("/api/v1/ingestion", input.deps.webhookSubscriptionRoutes);
  }

  return app;
};

export { createIngestionHttpApp };
