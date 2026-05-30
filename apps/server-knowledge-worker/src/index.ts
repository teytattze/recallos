import { loadConfig } from "@repo/server-platform";
import { Hono } from "hono";

const config = loadConfig();
const app = new Hono();

app.get("/api/v1/health", (c) => c.json({ message: "ok" }));

export default {
  port: config.PORT,
  fetch: app.fetch,
};
