import { Hono, type MiddlewareHandler } from "hono";

type CreateKnowledgeHttpAppInput = {
  deps: {
    graphNodeRoutes: Hono;
    graphNodeMiddlewares?: readonly MiddlewareHandler[];
  };
};

const createKnowledgeHttpApp = (input: CreateKnowledgeHttpAppInput) => {
  const app = new Hono();

  for (const middleware of input.deps.graphNodeMiddlewares ?? []) {
    app.use("/api/v1/graphs/*", middleware);
  }

  app.route("/api/v1/graphs", input.deps.graphNodeRoutes);

  return app;
};

export { createKnowledgeHttpApp };
