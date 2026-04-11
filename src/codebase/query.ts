import z from "zod";
import { and, eq } from "drizzle-orm";
import { cosineDistance, sql } from "drizzle-orm";
import { db } from "@/db/db";
import { codebaseChunk, codebaseFile, graphEdge } from "@/db/schema";
import { embedTexts } from "@/codebase/embed";

// -- Schemas --

const readInputSchema = z.object({
  kind: z.literal("codebase").describe("The memory kind to read from"),
  codebase: z
    .string()
    .describe("The name of the codebase to search in"),
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
      relatedFiles: z
        .object({
          filePath: z.string().describe("The file path of the related file"),
          relationship: z
            .enum(["references", "referencedBy"])
            .describe(
              "How the related file connects to the source: 'references' means the source file imports this file, 'referencedBy' means this file imports the source file",
            ),
          sourceFilePath: z
            .string()
            .describe(
              "The search-result file path that surfaced this related file",
            ),
        })
        .array()
        .describe(
          "Files related to the search results via the dependency graph",
        ),
    })
    .array()
    .describe("The results grouped by each input query"),
});

type SearchResult = z.infer<typeof readOutputSchema>;

async function getRelatedFiles(
  seedFileIds: string[],
  graphDepth: number,
): Promise<
  {
    filePath: string;
    relationship: "references" | "referencedBy";
    sourceFilePath: string;
  }[]
> {
  if (graphDepth <= 0 || seedFileIds.length === 0) return [];

  const seedArray = sql`ARRAY[${sql.join(
    seedFileIds.map((id) => sql`${id}::uuid`),
    sql`,`,
  )}]`;

  const rows = await db.execute<{
    file_path: string;
    relationship: "references" | "referencedBy";
    source_file_path: string;
  }>(sql`
    WITH RECURSIVE neighbors AS (
      SELECT
        ${graphEdge.fromId} AS file_id,
        ${graphEdge.toId} AS source_id,
        'references'::text AS relationship,
        1 AS depth
      FROM ${graphEdge}
      WHERE ${graphEdge.toId} = ANY(${seedArray})

      UNION ALL

      SELECT
        ${graphEdge.toId} AS file_id,
        ${graphEdge.fromId} AS source_id,
        'referencedBy'::text AS relationship,
        1 AS depth
      FROM ${graphEdge}
      WHERE ${graphEdge.fromId} = ANY(${seedArray})

      UNION ALL

      SELECT
        CASE WHEN e.to_id = n.file_id THEN e.from_id ELSE e.to_id END AS file_id,
        n.file_id AS source_id,
        CASE WHEN e.to_id = n.file_id THEN 'references'::text ELSE 'referencedBy'::text END AS relationship,
        n.depth + 1 AS depth
      FROM neighbors n
      JOIN ${graphEdge} e ON e.to_id = n.file_id OR e.from_id = n.file_id
      WHERE n.depth < ${graphDepth}
    )
    SELECT DISTINCT
      f.file_path,
      n.relationship,
      sf.file_path AS source_file_path
    FROM neighbors n
    JOIN ${codebaseFile} f ON f.id = n.file_id
    JOIN ${codebaseFile} sf ON sf.id = n.source_id
    WHERE n.file_id != ALL(${seedArray})
  `);

  return rows.map((row) => ({
    filePath: row.file_path,
    relationship: row.relationship,
    sourceFilePath: row.source_file_path,
  }));
}

async function searchCodebase(
  queries: string[],
  codebaseId: string,
  nResults = 7,
  graphDepth = 1,
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
          fileId: codebaseChunk.fileId,
          filePath: codebaseFile.filePath,
          distance: sql`${distance}`,
        })
        .from(codebaseChunk)
        .innerJoin(
          codebaseFile,
          and(
            eq(codebaseChunk.fileId, codebaseFile.id),
            eq(codebaseFile.codebaseId, codebaseId),
          ),
        )
        .orderBy(distance)
        .limit(nResults);

      const seedFileIds = [...new Set(rows.map((row) => row.fileId))];
      const relatedFiles = await getRelatedFiles(seedFileIds, graphDepth);

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
        relatedFiles,
      };
    }),
  );

  return { kind: "codebase", queryOutputs };
}

export { searchCodebase, getRelatedFiles, readInputSchema, readOutputSchema };
