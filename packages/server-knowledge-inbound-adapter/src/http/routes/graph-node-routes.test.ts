import type {
  GetGraphNodeByEventIdPort,
  GetGraphNodeByEventIdPortInput,
  GetGraphNodeByEventIdPortOutput,
} from "@repo/server-knowledge-core";

import { expect, test } from "bun:test";

import { createGraphNodeRoutes } from "./graph-node-routes.ts";

const tenant = "organization:org1";
const eventId = "event-1";
const graphNode = {
  id: "graph-node-1",
  tenant,
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
  eventId,
  graphId: "graph-1",
  rawEvent: { issue: { key: "REC-1" } },
};

class FakeGetGraphNodeByEventId implements GetGraphNodeByEventIdPort {
  readonly executeCalls: GetGraphNodeByEventIdPortInput[] = [];

  execute(
    input: GetGraphNodeByEventIdPortInput,
  ): GetGraphNodeByEventIdPortOutput {
    this.executeCalls.push(input);
    return Promise.resolve(graphNode);
  }
}

class MissingGetGraphNodeByEventId implements GetGraphNodeByEventIdPort {
  execute(): GetGraphNodeByEventIdPortOutput {
    return Promise.reject({
      kind: "GraphNodeNotFound",
      category: "not-found",
      message: "Graph node not found",
    });
  }
}

class InvalidGetGraphNodeByEventId implements GetGraphNodeByEventIdPort {
  execute(): GetGraphNodeByEventIdPortOutput {
    return Promise.reject({
      kind: "InvalidTenant",
      category: "validation",
      message: "Invalid tenant",
    });
  }
}

test("createGraphNodeRoutes: given an existing event's graph node, it should return the graph node", async () => {
  // GIVEN
  const getGraphNodeByEventId = new FakeGetGraphNodeByEventId();
  const routes = createGraphNodeRoutes({ deps: { getGraphNodeByEventId } });

  // WHEN
  const response = await routes.request(
    `http://localhost/by-event/${eventId}?tenant=${tenant}`,
  );

  // THEN
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(graphNode);
  expect(getGraphNodeByEventId.executeCalls).toEqual([
    { tenant, payload: { eventId } },
  ]);
});

test("createGraphNodeRoutes: given no graph node for the event, it should return 404", async () => {
  // GIVEN
  const routes = createGraphNodeRoutes({
    deps: { getGraphNodeByEventId: new MissingGetGraphNodeByEventId() },
  });

  // WHEN
  const response = await routes.request(
    `http://localhost/by-event/${eventId}?tenant=${tenant}`,
  );

  // THEN
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ message: "Graph node not found" });
});

test("createGraphNodeRoutes: given a missing tenant, it should return 422 without calling the use case", async () => {
  // GIVEN
  const getGraphNodeByEventId = new FakeGetGraphNodeByEventId();
  const routes = createGraphNodeRoutes({ deps: { getGraphNodeByEventId } });

  // WHEN
  const response = await routes.request(`http://localhost/by-event/${eventId}`);

  // THEN
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ message: "Invalid request" });
  expect(getGraphNodeByEventId.executeCalls).toEqual([]);
});

test("createGraphNodeRoutes: given a malformed tenant rejected by the core, it should return 422", async () => {
  // GIVEN
  const routes = createGraphNodeRoutes({
    deps: { getGraphNodeByEventId: new InvalidGetGraphNodeByEventId() },
  });

  // WHEN
  const response = await routes.request(
    `http://localhost/by-event/${eventId}?tenant=malformed`,
  );

  // THEN
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ message: "Invalid request" });
});
