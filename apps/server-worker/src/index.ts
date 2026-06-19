import { Hono } from "hono";

import { commonHttpApp, commonHttpConfig } from "./common.ts";
import { mongodbChangeStream } from "./ingestion.ts";

const app = new Hono();

app.route("", commonHttpApp);

mongodbChangeStream.listen().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

export default {
  port: commonHttpConfig.HTTP_PORT,
  fetch: app.fetch,
};
