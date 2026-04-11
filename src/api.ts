import { McpServer } from "@modelcontextprotocol/server";
import {
  searchByText,
  textSearchInputSchema,
  textSearchOutputSchema,
} from "@/codebase/query/vector-search";
import {
  relationshipSearchInputSchema,
  relationshipSearchOutputSchema,
  findRelatedFilesByCodebaseId,
} from "@/codebase/query/graph-search";
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
  "search_codebase_by_text",
  {
    title: "Search the codebase by meaning",
    description: `
    Always use this tool FIRST when you need to understand, explore, or research any part of the codebase.
    This is a semantic search — it finds code by meaning, not just keywords — so describe what you're
    looking for in plain language. Use it before reading files, before writing or modifying code, before
    answering questions about how something works, when debugging, when onboarding to unfamiliar code,
    when planning changes, and when investigating architecture, patterns, or dependencies.
    It returns matching source code chunks with file paths, symbol names, kinds, and line numbers.
    Examples: 'how are users authenticated', 'database connection pooling', 'error handling middleware',
    'where is the config validated', 'functions that modify user state'.
    Tip: use multiple queries to cover different angles of the same question for broader coverage.
    `,
    inputSchema: textSearchInputSchema,
    outputSchema: textSearchOutputSchema,
  },
  async (input) => {
    const cb = await ensureCodebase(input.codebase);
    const output = await searchByText(input.queries, cb.id);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  },
);

mcpServer.registerTool(
  "find_related_files_in_codebase",
  {
    title: "Find related files in the codebase",
    description: `
    Use this tool after finding relevant files (e.g. from search_codebase_by_text) to discover what
    other files are connected to them. It traverses the dependency graph to reveal imports, dependents,
    and connected modules — structure that is invisible when reading individual files.
    Use it to: understand the blast radius of a change, trace data flow across modules, find test files
    for a given source file, discover entry points that use a module, map module boundaries, and build
    a complete picture of how components relate before making cross-cutting changes.
    Returns related file paths with their relationship direction (references or referencedBy).
    Tip: pair with search_codebase_by_text — search first to find relevant files, then use this tool
    to explore their neighborhood in the dependency graph.
    `,
    inputSchema: relationshipSearchInputSchema,
    outputSchema: relationshipSearchOutputSchema,
  },
  async (input) => {
    const cb = await ensureCodebase(input.codebase);
    const output = await findRelatedFilesByCodebaseId(
      cb.id,
      input.filePaths,
      input.graphDepth,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  },
);

export default app;
