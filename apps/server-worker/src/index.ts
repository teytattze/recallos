import { Hono } from "hono";

import { commonHttpApp } from "./common.ts";
import { mongodbChangeStream } from "./ingestion.ts";
import { config } from "./runtime-config.ts";

const app = new Hono();

app.route("", commonHttpApp);

mongodbChangeStream.listen().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

export default {
  port: config.app.http.port,
  fetch: app.fetch,
};
