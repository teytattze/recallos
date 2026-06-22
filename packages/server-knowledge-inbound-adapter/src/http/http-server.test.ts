import { expect, test } from "bun:test";
import { Hono } from "hono";

import { createKnowledgeHttpApp } from "./http-server.ts";

test("createKnowledgeHttpApp: given graph node routes, it should mount them under the graph API path", async () => {
  // GIVEN
  const graphNodeRoutes = new Hono();
  graphNodeRoutes.get("/:graphId/nodes", (c) =>
    c.json({ graphId: c.req.param("graphId") }),
  );
  const app = createKnowledgeHttpApp({ deps: { graphNodeRoutes } });

  // WHEN
  const response = await app.request(
    "http://localhost/api/v1/graphs/graph-1/nodes",
  );

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ graphId: "graph-1" });
});
