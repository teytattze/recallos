import type {
  ListGraphNodesPort,
  SearchGraphPort,
} from "@repo/server-knowledge-core";

import { AppError } from "@repo/app-error";
import { Hono, type Context } from "hono";

import {
  graphPathParams,
  listGraphNodesQueryParams,
  searchGraphBody,
} from "../dtos/graph-node-dtos.ts";

type ResolveTenant = (c: Context) => string;

type CreateGraphNodeRoutesInput = {
  deps: {
    listGraphNodes: ListGraphNodesPort;
    searchGraph: SearchGraphPort;
  };
  resolveTenant: ResolveTenant;
};

const createGraphNodeRoutes = (input: CreateGraphNodeRoutesInput) => {
  const routes = new Hono();

  routes.get("/:graphId/nodes", async (c: Context) => {
    try {
      const pathParams = graphPathParams.parse({
        graphId: c.req.param("graphId"),
      });
      const queryParams = listGraphNodesQueryParams.parse({
        eventId: c.req.query("eventId"),
      });
      const graphNodes = await input.deps.listGraphNodes.execute({
        tenant: input.resolveTenant(c),
        filters: {
          eventId: queryParams.eventId,
          graphId: pathParams.graphId,
        },
      });

      return c.json(graphNodes);
    } catch (error) {
      const appError = AppError.from(error);
      return c.json(appError.toJSON(), appError.httpStatus);
    }
  });

  routes.post("/:graphId/search", async (c: Context) => {
    try {
      const pathParams = graphPathParams.parse({
        graphId: c.req.param("graphId"),
      });
      const body = searchGraphBody.parse(
        await c.req.json().catch((error: unknown) => {
          throw AppError.ofCode("invariantViolation", { cause: error });
        }),
      );
      const results = await input.deps.searchGraph.execute({
        tenant: input.resolveTenant(c),
        payload: { graphId: pathParams.graphId, query: body.query },
      });

      return c.json(results);
    } catch (error) {
      const appError = AppError.from(error);
      return c.json(appError.toJSON(), appError.httpStatus);
    }
  });

  return routes;
};

export { createGraphNodeRoutes };
