import type {
  ListGraphNodesPort,
  ListGraphNodesPortInput,
  ListGraphNodesPortOutput,
  SearchGraphPort,
  SearchGraphPortInput,
  SearchGraphPortOutput,
} from "@repo/server-knowledge-core";

import { AppError } from "@repo/app-error";
import { createHttpErrorHandler } from "@repo/server-platform";
import { expect, test } from "bun:test";
import { Hono } from "hono";

import { createGraphNodeRoutes } from "./graph-node-routes.ts";

const withErrorHandling = (routes: Hono) => {
  const app = new Hono();
  app.onError(createHttpErrorHandler());
  app.route("", routes);
  return app;
};

const tenant = "organization:org1";
const eventId = "event-1";
const graphId = "01952d3f-0000-7000-8000-000000000100";
const graphNode = {
  id: "graph-node-1",
  tenant,
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
  eventId,
  graphId,
  rawEvent: { issue: { key: "REC-1" } },
};

class FakeListGraphNodes implements ListGraphNodesPort {
  readonly executeCalls: ListGraphNodesPortInput[] = [];

  execute(input: ListGraphNodesPortInput): ListGraphNodesPortOutput {
    this.executeCalls.push(input);
    return Promise.resolve({ data: [graphNode] });
  }
}

class FakeSearchGraph implements SearchGraphPort {
  readonly executeCalls: SearchGraphPortInput[] = [];

  execute(input: SearchGraphPortInput): SearchGraphPortOutput {
    this.executeCalls.push(input);
    return Promise.resolve({ data: [{ rawEvent: graphNode.rawEvent }] });
  }
}

class EmptyListGraphNodes implements ListGraphNodesPort {
  execute(): ListGraphNodesPortOutput {
    return Promise.resolve({ data: [] });
  }
}

class InvalidListGraphNodes implements ListGraphNodesPort {
  execute(): ListGraphNodesPortOutput {
    return Promise.reject(AppError.ofCode("invariantViolation"));
  }
}

test("createGraphNodeRoutes: given matching graph nodes, it should return the graph nodes", async () => {
  // GIVEN
  const listGraphNodes = new FakeListGraphNodes();
  const routes = createGraphNodeRoutes({
    deps: { listGraphNodes, searchGraph: new FakeSearchGraph() },
    resolveTenant: () => tenant,
  });

  // WHEN
  const response = await routes.request(
    `http://localhost/${graphId}/nodes?eventId=${eventId}`,
  );

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: [graphNode] });
  expect(listGraphNodes.executeCalls).toEqual([
    { tenant, filters: { eventId, graphId } },
  ]);
});

test("createGraphNodeRoutes: given no matching graph nodes, it should return an empty list", async () => {
  // GIVEN
  const routes = createGraphNodeRoutes({
    deps: {
      listGraphNodes: new EmptyListGraphNodes(),
      searchGraph: new FakeSearchGraph(),
    },
    resolveTenant: () => tenant,
  });

  // WHEN
  const response = await routes.request(
    `http://localhost/${graphId}/nodes?eventId=${eventId}`,
  );

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: [] });
});

test("createGraphNodeRoutes: given a missing event id, it should return 422 without calling the use case", async () => {
  // GIVEN
  const listGraphNodes = new FakeListGraphNodes();
  const routes = createGraphNodeRoutes({
    deps: { listGraphNodes, searchGraph: new FakeSearchGraph() },
    resolveTenant: () => tenant,
  });

  // WHEN
  const response = await withErrorHandling(routes).request(
    `http://localhost/${graphId}/nodes`,
  );

  // THEN
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    code: "invariantViolation",
    message: "Invariant violation",
  });
  expect(listGraphNodes.executeCalls).toEqual([]);
});

test("createGraphNodeRoutes: given a malformed tenant rejected by the core, it should return 422", async () => {
  // GIVEN
  const routes = createGraphNodeRoutes({
    deps: {
      listGraphNodes: new InvalidListGraphNodes(),
      searchGraph: new FakeSearchGraph(),
    },
    resolveTenant: () => "malformed",
  });

  // WHEN
  const response = await withErrorHandling(routes).request(
    `http://localhost/${graphId}/nodes?eventId=${eventId}&tenant=${tenant}`,
  );

  // THEN
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    code: "invariantViolation",
    message: "Invariant violation",
  });
});

test("createGraphNodeRoutes: given a search query, it should return matching raw event DTOs", async () => {
  // GIVEN
  const searchGraph = new FakeSearchGraph();
  const routes = createGraphNodeRoutes({
    deps: { listGraphNodes: new EmptyListGraphNodes(), searchGraph },
    resolveTenant: () => tenant,
  });

  // WHEN
  const response = await routes.request(`http://localhost/${graphId}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "billing incident" }),
  });

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: [{ rawEvent: { issue: { key: "REC-1" } } }],
  });
  expect(searchGraph.executeCalls).toEqual([
    { tenant, payload: { graphId, query: "billing incident" } },
  ]);
});

test("createGraphNodeRoutes: given malformed search JSON, it should return 422", async () => {
  // GIVEN
  const routes = createGraphNodeRoutes({
    deps: {
      listGraphNodes: new EmptyListGraphNodes(),
      searchGraph: new FakeSearchGraph(),
    },
    resolveTenant: () => tenant,
  });

  // WHEN
  const response = await withErrorHandling(routes).request(
    `http://localhost/${graphId}/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    },
  );

  // THEN
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({
    code: "invariantViolation",
    message: "Invariant violation",
  });
});
