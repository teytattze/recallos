import type { GetGraphNodeByEventIdPort } from "@repo/server-knowledge-core";

import { Hono, type Context } from "hono";
import { ZodError } from "zod";

import {
  graphNodeByEventIdPathParams,
  graphNodeByEventIdQueryParams,
} from "../dtos/graph-node-dtos.ts";

type CreateGraphNodeRoutesInput = {
  deps: {
    getGraphNodeByEventId: GetGraphNodeByEventIdPort;
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

  routes.get("/by-event/:eventId", async (c: Context) => {
    try {
      const pathParams = graphNodeByEventIdPathParams.parse({
        eventId: c.req.param("eventId"),
      });
      const queryParams = graphNodeByEventIdQueryParams.parse({
        tenant: c.req.query("tenant"),
      });
      const graphNode = await input.deps.getGraphNodeByEventId.execute({
        tenant: queryParams.tenant,
        payload: { eventId: pathParams.eventId },
      });

      return c.json(graphNode);
    } catch (error) {
      if (
        error instanceof ZodError ||
        (isCategorizedError(error) && error.category === "validation")
      ) {
        return c.json({ message: "Invalid request" }, 422);
      }
      if (isCategorizedError(error) && error.category === "not-found") {
        return c.json({ message: "Graph node not found" }, 404);
      }

      throw error;
    }
  });

  return routes;
};

export { createGraphNodeRoutes };
