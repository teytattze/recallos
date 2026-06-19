import { Hono } from "hono";

import { commonHttpApp } from "./common";
import { ingestionHttpApp } from "./ingestion";
import { config } from "./runtime-config.ts";

const app = new Hono();

app.route("", commonHttpApp);
app.route("", ingestionHttpApp);

export default {
  port: config.app.http.port,
  fetch: app.fetch,
};
