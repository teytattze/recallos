import type {
  ListGraphNodesPort,
  ListGraphNodesPortInput,
  ListGraphNodesPortOutput,
} from "@repo/server-knowledge-core";

import { expect, test } from "bun:test";

import { createGraphNodeRoutes } from "./graph-node-routes.ts";

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
    return Promise.resolve([graphNode]);
  }
}

class EmptyListGraphNodes implements ListGraphNodesPort {
  execute(): ListGraphNodesPortOutput {
    return Promise.resolve([]);
  }
}

class InvalidListGraphNodes implements ListGraphNodesPort {
  execute(): ListGraphNodesPortOutput {
    return Promise.reject({
      kind: "InvalidTenant",
      category: "validation",
      message: "Invalid tenant",
    });
  }
}

test("createGraphNodeRoutes: given matching graph nodes, it should return the graph nodes", async () => {
  // GIVEN
  const listGraphNodes = new FakeListGraphNodes();
  const routes = createGraphNodeRoutes({ deps: { listGraphNodes } });

  // WHEN
  const response = await routes.request(
    `http://localhost/${graphId}/nodes?eventId=${eventId}&tenant=${tenant}`,
  );

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([graphNode]);
  expect(listGraphNodes.executeCalls).toEqual([
    { tenant, filters: { eventId, graphId } },
  ]);
});

test("createGraphNodeRoutes: given no matching graph nodes, it should return an empty list", async () => {
  // GIVEN
  const routes = createGraphNodeRoutes({
    deps: { listGraphNodes: new EmptyListGraphNodes() },
  });

  // WHEN
  const response = await routes.request(
    `http://localhost/${graphId}/nodes?eventId=${eventId}&tenant=${tenant}`,
  );

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
});

test("createGraphNodeRoutes: given a missing tenant, it should return 422 without calling the use case", async () => {
  // GIVEN
  const listGraphNodes = new FakeListGraphNodes();
  const routes = createGraphNodeRoutes({ deps: { listGraphNodes } });

  // WHEN
  const response = await routes.request(
    `http://localhost/${graphId}/nodes?eventId=${eventId}`,
  );

  // THEN
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ message: "Invalid request" });
  expect(listGraphNodes.executeCalls).toEqual([]);
});

test("createGraphNodeRoutes: given a malformed tenant rejected by the core, it should return 422", async () => {
  // GIVEN
  const routes = createGraphNodeRoutes({
    deps: { listGraphNodes: new InvalidListGraphNodes() },
  });

  // WHEN
  const response = await routes.request(
    `http://localhost/${graphId}/nodes?eventId=${eventId}&tenant=malformed`,
  );

  // THEN
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ message: "Invalid request" });
});
