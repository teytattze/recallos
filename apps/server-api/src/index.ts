import { createHttpErrorHandler } from "@repo/server-platform";
import { Hono } from "hono";

import { commonHttpApp } from "./common";
import { config } from "./config.ts";
import { iamHttpApp } from "./iam";
import { ingestionHttpApp } from "./ingestion";
import { knowledgeHttpApp } from "./knowledge";

const app = new Hono();

app.onError(createHttpErrorHandler());

app.route("", commonHttpApp);
app.route("", iamHttpApp);
app.route("", ingestionHttpApp);
app.route("", knowledgeHttpApp);

export default {
  port: config.app.http.port,
  fetch: app.fetch,
};
