import { Hono } from "hono";

import { commonHttpApp, commonHttpConfig } from "./common";

const app = new Hono();

app.route("", commonHttpApp);

export default {
  port: commonHttpConfig.PORT,
  fetch: app.fetch,
};
