import { McpServer } from "@modelcontextprotocol/server";
import {
  searchCodebase,
  readInputSchema,
  readOutputSchema,
} from "@/codebase/query";
import { ensureCodebase } from "@/codebase/codebase";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { timeout } from "hono/timeout";

const app = new Hono();

const mcpServer = new McpServer({
  name: "recallos",
  version: "0.0.0",
});
const transport = new StreamableHTTPTransport();

app.use(timeout(1 * 60 * 1000));

app.all("/mcp", async (c) => {
  if (!mcpServer.isConnected()) {
    await mcpServer.connect(transport);
  }
  return transport.handleRequest(c);
});

mcpServer.registerTool(
  "search_codebase",
  {
    title: "Search the codebase by meaning",
    description: `
    Search the codebase by meaning — use this tool to explore architecture, find implementations,
    locate functions/types/classes, understand patterns, research how features work, plan changes,
    and find relevant code before writing or modifying it. Returns matching source code chunks with
    file paths, symbol names, symbol kinds, and line numbers. Accepts natural-language queries
    (e.g. 'authentication middleware', 'database connection setup', 'error handling patterns').
    `,
    inputSchema: readInputSchema,
    outputSchema: readOutputSchema,
  },
  async (input) => {
    const cb = await ensureCodebase(input.codebase);
    const output = await searchCodebase(input.queries, cb.id);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  },
);

export default app;
