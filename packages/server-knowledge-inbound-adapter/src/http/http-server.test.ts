import { expect, test } from "bun:test";
import { Hono } from "hono";

import { createKnowledgeHttpApp } from "./http-server.ts";

test("createKnowledgeHttpApp: given graph node routes, it should mount them under the graph node API path", async () => {
  // GIVEN
  const graphNodeRoutes = new Hono();
  graphNodeRoutes.get("/by-event/:eventId", (c) =>
    c.json({ eventId: c.req.param("eventId") }),
  );
  const app = createKnowledgeHttpApp({ deps: { graphNodeRoutes } });

  // WHEN
  const response = await app.request(
    "http://localhost/api/v1/graph-nodes/by-event/event-1",
  );

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ eventId: "event-1" });
});
