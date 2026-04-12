import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/db";
import { codebaseFileTable, codebaseFileGraphEdgeTable } from "@/db/schema";
import { newBaseFieldsValue } from "@/db/util";
import { extractImports } from "@/codebase/graph/router";
import { resolveSpecifier } from "@/codebase/graph/resolver";

async function buildFileGraph(
  projectRoot: string,
  codebaseId: string,
): Promise<{
  edgesCreated: number;
  filesProcessed: number;
}> {
  const files = await db
    .select({
      id: codebaseFileTable.id,
      filePath: codebaseFileTable.filePath,
      content: codebaseFileTable.content,
    })
    .from(codebaseFileTable)
    .where(
      and(
        eq(codebaseFileTable.codebaseId, codebaseId),
        eq(codebaseFileTable.status, "complete"),
      ),
    );

  const pathToId = new Map<string, string>();
  for (const file of files) {
    pathToId.set(file.filePath, file.id);
  }

  type EdgeCandidate = { fromId: string; toId: string };
  const edges: EdgeCandidate[] = [];

  for (const file of files) {
    const specifiers = extractImports(file.content, file.filePath);

    for (const spec of specifiers) {
      const resolvedPath = resolveSpecifier(spec, file.filePath, projectRoot);
      if (!resolvedPath) continue;

      const toId = pathToId.get(resolvedPath);
      if (!toId) continue;

      if (toId === file.id) continue;

      edges.push({ fromId: file.id, toId });
    }
  }

  const fileIds = files.map((f) => f.id);

  await db.transaction(async (tx) => {
    // Only delete edges belonging to this codebase's files
    if (fileIds.length > 0) {
      await tx
        .delete(codebaseFileGraphEdgeTable)
        .where(inArray(codebaseFileGraphEdgeTable.fromId, fileIds));
    }

    if (edges.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < edges.length; i += BATCH_SIZE) {
        const batch = edges.slice(i, i + BATCH_SIZE);
        await tx.insert(codebaseFileGraphEdgeTable).values(
          batch.map((edge) => ({
            ...newBaseFieldsValue(),
            relationship: "references" as const,
            fromId: edge.fromId,
            toId: edge.toId,
          })),
        );
      }
    }
  });

  return {
    edgesCreated: edges.length,
    filesProcessed: files.length,
  };
}

export { buildFileGraph };
