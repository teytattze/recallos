import z from "zod";
import { eq } from "drizzle-orm";
import { cosineDistance, sql } from "drizzle-orm";
import { db } from "@/db/db";
import { codebaseChunk, codebaseFile } from "@/db/schema";
import { embedTexts } from "@/codebase/embed";

// -- Schemas --

const readInputSchema = z.object({
  kind: z.literal("codebase").describe("The memory kind to read from"),
  queries: z
    .string()
    .array()
    .describe(
      "Natural-language search queries describing what you're looking for (e.g. 'how authentication works', 'database query helpers', 'API route handlers'). Use multiple queries to cover different angles of the same question.",
    ),
});

const readOutputSchema = z.object({
  kind: z.literal("codebase").describe("The memory kind that was read from"),
  queryOutputs: z
    .object({
      originalQuery: z
        .string()
        .describe("The original search query that produced these results"),
      results: z
        .object({
          id: z.string().describe("The unique ID of the code"),
          document: z
            .string()
            .describe("The actual document (content) of the search result"),
          filePath: z
            .string()
            .describe(
              "The relative file path location of the actual document (content)",
            ),
          symbolName: z
            .string()
            .describe("The name of the symbol (function, class, type, etc.)"),
          symbolKind: z
            .string()
            .describe(
              "The kind of symbol: function, class, interface, type, enum, variable, preamble, or file",
            ),
          startLine: z
            .number()
            .describe(
              "The starting line number of the symbol in the source file",
            ),
          endLine: z
            .number()
            .describe(
              "The ending line number of the symbol in the source file",
            ),
        })
        .array()
        .describe("The list of matching code results for this query"),
    })
    .array()
    .describe("The results grouped by each input query"),
});

type SearchResult = z.infer<typeof readOutputSchema>;

async function searchCodebase(
  queries: string[],
  nResults = 10,
): Promise<SearchResult> {
  const embeddings = await embedTexts(queries);

  const queryOutputs = await Promise.all(
    queries.map(async (query, i) => {
      const queryEmbedding = embeddings[i] ?? [];
      const distance = cosineDistance(codebaseChunk.embedding, queryEmbedding);

      const rows = await db
        .select({
          id: codebaseChunk.id,
          content: codebaseChunk.content,
          symbolName: codebaseChunk.symbolName,
          symbolKind: codebaseChunk.symbolKind,
          startLine: codebaseChunk.startLine,
          endLine: codebaseChunk.endLine,
          filePath: codebaseFile.filePath,
          distance: sql`${distance}`,
        })
        .from(codebaseChunk)
        .innerJoin(codebaseFile, eq(codebaseChunk.fileId, codebaseFile.id))
        .orderBy(distance)
        .limit(nResults);

      return {
        originalQuery: query,
        results: rows.map((row) => ({
          id: row.id,
          document: row.content,
          filePath: row.filePath,
          symbolName: row.symbolName,
          symbolKind: row.symbolKind,
          startLine: row.startLine,
          endLine: row.endLine,
        })),
      };
    }),
  );

  return { kind: "codebase", queryOutputs };
}

export { searchCodebase, readInputSchema, readOutputSchema };
