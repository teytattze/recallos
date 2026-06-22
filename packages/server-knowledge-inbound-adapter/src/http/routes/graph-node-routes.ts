import type { ListGraphNodesPort } from "@repo/server-knowledge-core";

import { Hono, type Context } from "hono";
import { ZodError } from "zod";

import {
  listGraphNodesPathParams,
  listGraphNodesQueryParams,
} from "../dtos/graph-node-dtos.ts";

type CreateGraphNodeRoutesInput = {
  deps: {
    listGraphNodes: ListGraphNodesPort;
  };
};

type CategorizedError = {
  category: string;
};

const isCategorizedError = (error: unknown): error is CategorizedError =>
  typeof error === "object" &&
  error !== null &&
  "category" in error &&
  typeof error.category === "string";

const createGraphNodeRoutes = (input: CreateGraphNodeRoutesInput) => {
  const routes = new Hono();

  routes.get("/:graphId/nodes", async (c: Context) => {
    try {
      const pathParams = listGraphNodesPathParams.parse({
        graphId: c.req.param("graphId"),
      });
      const queryParams = listGraphNodesQueryParams.parse({
        eventId: c.req.query("eventId"),
        tenant: c.req.query("tenant"),
      });
      const graphNodes = await input.deps.listGraphNodes.execute({
        tenant: queryParams.tenant,
        filters: {
          eventId: queryParams.eventId,
          graphId: pathParams.graphId,
        },
      });

      return c.json(graphNodes);
    } catch (error) {
      if (
        error instanceof ZodError ||
        (isCategorizedError(error) && error.category === "validation")
      ) {
        return c.json({ message: "Invalid request" }, 422);
      }
      throw error;
    }
  });

  return routes;
};

export { createGraphNodeRoutes };
