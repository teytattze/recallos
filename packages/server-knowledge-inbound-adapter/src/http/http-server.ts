import { Hono } from "hono";

type CreateKnowledgeHttpAppInput = {
  deps: {
    graphNodeRoutes: Hono;
  };
};

const createKnowledgeHttpApp = (input: CreateKnowledgeHttpAppInput) => {
  const app = new Hono();

  app.route("/api/v1/graphs", input.deps.graphNodeRoutes);

  return app;
};

export { createKnowledgeHttpApp };
