import { Hono, type MiddlewareHandler } from "hono";

type CreateKnowledgeHttpAppInput = {
  deps: {
    graphNodeRoutes: Hono;
    graphNodeMiddlewares?: readonly MiddlewareHandler[];
    mcpRoutes?: Hono;
    mcpMiddlewares?: readonly MiddlewareHandler[];
  };
};

const createKnowledgeHttpApp = (input: CreateKnowledgeHttpAppInput) => {
  const app = new Hono();

  for (const middleware of input.deps.graphNodeMiddlewares ?? []) {
    app.use("/api/v1/graphs/*", middleware);
  }

  app.route("/api/v1/graphs", input.deps.graphNodeRoutes);

  for (const middleware of input.deps.mcpMiddlewares ?? []) {
    app.use("/api/v1/knowledge/mcp", middleware);
  }

  if (input.deps.mcpRoutes !== undefined) {
    app.route("/api/v1/knowledge", input.deps.mcpRoutes);
  }

  return app;
};

export { createKnowledgeHttpApp };
