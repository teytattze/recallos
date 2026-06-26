import type { SearchGraphPort } from "@repo/server-knowledge-core";

import { Hono, type Context } from "hono";
import { z, ZodError } from "zod";

type ResolveTenant = (c: Context) => string;

type CreateKnowledgeMcpRoutesInput = {
  deps: { searchGraph: SearchGraphPort };
  resolveTenant: ResolveTenant;
};

const rpcRequestBody = z.object({
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.unknown().optional(),
});

const toolCallParams = z.object({
  name: z.literal("search_knowledge"),
  arguments: z.object({
    graphId: z.string().trim().min(1),
    query: z.string().trim().min(1),
  }),
});

const createKnowledgeMcpRoutes = (input: CreateKnowledgeMcpRoutesInput) => {
  const routes = new Hono();

  routes.post("/mcp", async (c: Context) => {
    const parsedRequest = await parseRpcRequest(c);

    if (!parsedRequest.success) {
      return c.json({
        jsonrpc: "2.0",
        id: null,
        error: parsedRequest.error,
      });
    }

    const request = parsedRequest.data;

    if (request.method === "tools/list") {
      return c.json({
        jsonrpc: "2.0",
        id: request.id ?? null,
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
    }

    if (request.method === "tools/call") {
      try {
        const params = toolCallParams.parse(request.params);
        const result = await input.deps.searchGraph.execute({
          tenant: input.resolveTenant(c),
          payload: params.arguments,
        });

        return c.json({
          jsonrpc: "2.0",
          id: request.id ?? null,
          result: {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return c.json({
            jsonrpc: "2.0",
            id: request.id ?? null,
            error: { code: -32602, message: "Invalid params" },
          });
        }
        throw error;
      }
    }

    return c.json({
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: { code: -32601, message: "Method not found" },
    });
  });

  return routes;
};

const parseRpcRequest = async (
  c: Context,
): Promise<
  | { success: true; data: z.infer<typeof rpcRequestBody> }
  | { success: false; error: { code: number; message: string } }
> => {
  try {
    return { success: true, data: rpcRequestBody.parse(await c.req.json()) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: { code: -32700, message: "Parse error" },
      };
    }
    if (error instanceof ZodError) {
      return {
        success: false,
        error: { code: -32600, message: "Invalid request" },
      };
    }
    throw error;
  }
};

export { createKnowledgeMcpRoutes };
