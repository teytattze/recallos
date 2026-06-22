import { Hono } from "hono";

import { commonHttpApp, markWorkerReady } from "./common.ts";
import { config } from "./config.ts";
import { mongodbChangeStream } from "./ingestion.ts";

const app = new Hono();

app.route("", commonHttpApp);

mongodbChangeStream
  .listen({ onReady: markWorkerReady })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

export default {
  port: config.app.http.port,
  fetch: app.fetch,
};
