import { McpServer } from "@modelcontextprotocol/server";
import { memoryManager } from "./memory-manager";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";

const app = new Hono();

const mcpServer = new McpServer({
  name: "recall-os",
  version: "0.0.0",
});
const transport = new StreamableHTTPTransport();

app.all("/mcp", async (c) => {
  if (!mcpServer.isConnected()) {
    await mcpServer.connect(transport);
  }
  return transport.handleRequest(c);
});

mcpServer.registerTool(
  "read_memory",
  {
    description: "Read different kind of memory, including codebase",
    inputSchema: memoryManager.readInputSchema,
    outputSchema: memoryManager.readOutputSchema,
  },
  async (input) => {
    const output = await memoryManager.read(input);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  },
);

export default app;
