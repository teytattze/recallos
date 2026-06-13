import { Hono } from "hono";

import { commonHttpApp, commonHttpConfig } from "./common";
import { ingestionHttpApp } from "./ingestion";

const app = new Hono();

app.route("", commonHttpApp);
app.route("", ingestionHttpApp);

export default {
  port: commonHttpConfig.HTTP_PORT,
  fetch: app.fetch,
};
