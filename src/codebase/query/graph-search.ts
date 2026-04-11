import z from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db/db";
import { codebaseFile, graphEdge } from "@/db/schema";
import { ensureCodebase } from "@/codebase/codebase";

// -- Schemas --

const relationshipSearchInputSchema = z.object({
  codebase: z.string().describe("The name of the codebase to search in"),
  filePaths: z
    .string()
    .array()
    .describe(
      "File paths to find relationships for — use file paths from search_codebase_by_text results or any known paths (e.g. ['src/api.ts', 'src/db/schema.ts'])",
    ),
  graphDepth: z
    .number()
    .optional()
    .default(1)
    .describe(
      "How many hops to traverse in the dependency graph (default: 1). Use 2-3 for broader exploration when understanding cross-cutting concerns or tracing data flow across multiple modules.",
    ),
});

const relationshipSearchOutputSchema = z.object({
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
    .describe("Files related to the input file paths via the dependency graph"),
});

type RelationshipSearchResult = z.infer<typeof relationshipSearchOutputSchema>;

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

async function findRelatedFilesByCodebaseId(
  codebaseId: string,
  filePaths: string[],
  graphDepth = 1,
): Promise<RelationshipSearchResult> {
  const files = await db
    .select({ id: codebaseFile.id })
    .from(codebaseFile)
    .where(
      and(
        inArray(codebaseFile.filePath, filePaths),
        eq(codebaseFile.codebaseId, codebaseId),
      ),
    );

  const fileIds = files.map((f) => f.id);
  const relatedFiles = await getRelatedFiles(fileIds, graphDepth);

  return { relatedFiles };
}

async function searchByRelationship(
  codebaseName: string,
  filePaths: string[],
  graphDepth = 1,
): Promise<RelationshipSearchResult> {
  const cb = await ensureCodebase(codebaseName);
  return findRelatedFilesByCodebaseId(cb.id, filePaths, graphDepth);
}

export {
  findRelatedFilesByCodebaseId,
  searchByRelationship,
  relationshipSearchInputSchema,
  relationshipSearchOutputSchema,
};
