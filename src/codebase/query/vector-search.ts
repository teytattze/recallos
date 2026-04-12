import z from "zod";
import { and, eq } from "drizzle-orm";
import { cosineDistance, sql } from "drizzle-orm";
import { db } from "@/db/db";
import { codebaseChunkTable, codebaseFileTable } from "@/db/schema";
import { embedTexts } from "@/codebase/embed";

// -- Schemas --

const textSearchInputSchema = z.object({
  codebaseId: z
    .uuidv7()
    .describe(
      "The ID of the codebase to search in. Get the ID from .recallos.json",
    ),
  queries: z
    .string()
    .array()
    .describe(
      "Natural-language search queries describing what you're looking for. This is semantic search — describe intent and meaning, not exact code tokens. Use multiple diverse queries to maximize coverage (e.g. ['user authentication flow', 'login session validation', 'JWT token verification'] to find auth-related code from different angles).",
    ),
});

const textSearchOutputSchema = z.object({
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

type TextSearchResult = z.infer<typeof textSearchOutputSchema>;

async function searchByText(
  queries: string[],
  codebaseId: string,
  nResults = 7,
): Promise<TextSearchResult> {
  const embeddings = await embedTexts(queries);

  const queryOutputs = await Promise.all(
    queries.map(async (query, i) => {
      const queryEmbedding = embeddings[i] ?? [];
      const distance = cosineDistance(
        codebaseChunkTable.embedding,
        queryEmbedding,
      );

      const rows = await db
        .select({
          id: codebaseChunkTable.id,
          content: codebaseChunkTable.content,
          symbolName: codebaseChunkTable.symbolName,
          symbolKind: codebaseChunkTable.symbolKind,
          startLine: codebaseChunkTable.startLine,
          endLine: codebaseChunkTable.endLine,
          filePath: codebaseFileTable.filePath,
          distance: sql`${distance}`,
        })
        .from(codebaseChunkTable)
        .innerJoin(
          codebaseFileTable,
          and(
            eq(codebaseChunkTable.fileId, codebaseFileTable.id),
            eq(codebaseFileTable.codebaseId, codebaseId),
          ),
        )
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

  return { queryOutputs };
}

export { searchByText, textSearchInputSchema, textSearchOutputSchema };
