import { Hono } from "hono";

const createCommonHttpApp = () => {
  const app = new Hono();

  app.get("/api/v1/health", (c) => c.json({ message: "ok" }));

  return app;
};

export { createCommonHttpApp };
