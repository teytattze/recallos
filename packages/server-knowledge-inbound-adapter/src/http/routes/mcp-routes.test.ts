import type {
  SearchGraphPort,
  SearchGraphPortInput,
  SearchGraphPortOutput,
} from "@repo/server-knowledge-core";

import { expect, test } from "bun:test";

import { createKnowledgeMcpRoutes } from "./mcp-routes.ts";

const tenant = "organization:org1";
const graphId = "01952d3f-0000-7000-8000-000000000100";

class FakeSearchGraph implements SearchGraphPort {
  readonly executeCalls: SearchGraphPortInput[] = [];

  execute(input: SearchGraphPortInput): SearchGraphPortOutput {
    this.executeCalls.push(input);
    return Promise.resolve({
      data: [{ rawEvent: { issue: { key: "REC-1" } } }],
    });
  }
}

test("createKnowledgeMcpRoutes: given a tool list request, it should expose search knowledge", async () => {
  const routes = createKnowledgeMcpRoutes({
    deps: { searchGraph: new FakeSearchGraph() },
    resolveTenant: () => tenant,
  });

  const response = await routes.request("http://localhost/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    jsonrpc: "2.0",
    id: 1,
    result: {
      tools: [
        {
          name: "search_knowledge",
          description: "Search graph nodes by semantic query.",
          inputSchema: {
            type: "object",
            properties: {
              graphId: { type: "string" },
              query: { type: "string" },
            },
            required: ["graphId", "query"],
          },
        },
      ],
    },
  });
});

test("createKnowledgeMcpRoutes: given a search knowledge tool call, it should return raw event DTOs", async () => {
  const searchGraph = new FakeSearchGraph();
  const routes = createKnowledgeMcpRoutes({
    deps: { searchGraph },
    resolveTenant: () => tenant,
  });

  const response = await routes.request("http://localhost/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "call-1",
      method: "tools/call",
      params: {
        name: "search_knowledge",
        arguments: { graphId, query: "billing incident" },
      },
    }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    jsonrpc: "2.0",
    id: "call-1",
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            data: [{ rawEvent: { issue: { key: "REC-1" } } }],
          }),
        },
      ],
      structuredContent: { data: [{ rawEvent: { issue: { key: "REC-1" } } }] },
    },
  });
  expect(searchGraph.executeCalls).toEqual([
    { tenant, payload: { graphId, query: "billing incident" } },
  ]);
});

test("createKnowledgeMcpRoutes: given malformed JSON, it should return a JSON-RPC parse error", async () => {
  const routes = createKnowledgeMcpRoutes({
    deps: { searchGraph: new FakeSearchGraph() },
    resolveTenant: () => tenant,
  });

  const response = await routes.request("http://localhost/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    jsonrpc: "2.0",
    id: null,
    error: { code: -32700, message: "Parse error" },
  });
});
