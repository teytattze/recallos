import { Hono } from "hono";

type CreateKnowledgeHttpAppInput = {
  deps: {
    graphNodeRoutes: Hono;
  };
};

const createKnowledgeHttpApp = (input: CreateKnowledgeHttpAppInput) => {
  const app = new Hono();

  app.route("/api/v1/graph-nodes", input.deps.graphNodeRoutes);

  return app;
};

export { createKnowledgeHttpApp };
