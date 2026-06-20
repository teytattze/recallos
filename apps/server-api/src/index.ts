import { Hono } from "hono";

import { commonHttpApp } from "./common";
import { config } from "./config.ts";
import { ingestionHttpApp } from "./ingestion";

const app = new Hono();

app.route("", commonHttpApp);
app.route("", ingestionHttpApp);

export default {
  port: config.app.http.port,
  fetch: app.fetch,
};
