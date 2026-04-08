import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/db";
import { codebaseChunk, codebaseFile, graphEdge } from "@/db/schema";
import { chunkFile } from "@/codebase/chunker/router";
import { extractReferences } from "@/codebase/graph/router";
import type { RawReference } from "@/codebase/graph/types";
import { embedTexts } from "@/codebase/embed";
import { newBaseFieldsValue } from "@/db/util";
import { hash, loadFiles } from "@/lib/util";

type DiskFile = {
  path: string;
  content: string;
  contentHashDigest: string;
};

type IndexingOpts = {
  include: string[];
  exclude: string[];
  force: boolean;
};

type IndexedChunk = {
  id: string;
  symbolName: string;
};

type FileIndexResult = {
  chunks: IndexedChunk[];
  rawRefs: RawReference[];
};

function diffFiles(
  diskFiles: { path: string; contentHashDigest: string }[],
  dbFiles: { filePath: string; contentDigest: string }[],
) {
  const dbMap = new Map(dbFiles.map((f) => [f.filePath, f.contentDigest]));
  const diskMap = new Map(diskFiles.map((f) => [f.path, f.contentHashDigest]));

  const added: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];

  for (const file of diskFiles) {
    const storedHash = dbMap.get(file.path);
    if (storedHash === undefined) {
      added.push(file.path);
    } else if (storedHash !== file.contentHashDigest) {
      modified.push(file.path);
    } else {
      unchanged.push(file.path);
    }
  }

  const deleted = dbFiles
    .filter((f) => !diskMap.has(f.filePath))
    .map((f) => f.filePath);

  return { added, modified, deleted, unchanged };
}

async function indexFile(
  file: DiskFile,
  opts?: { deleteExisting?: boolean },
): Promise<FileIndexResult> {
  const result: FileIndexResult = { chunks: [], rawRefs: [] };

  await db.transaction(async (tx) => {
    // Delete existing file row first if re-indexing a modified file
    if (opts?.deleteExisting) {
      await tx.delete(codebaseFile).where(eq(codebaseFile.filePath, file.path));
    }

    // Insert file as pending
    const [inserted] = await tx
      .insert(codebaseFile)
      .values({
        ...newBaseFieldsValue(),
        filePath: file.path,
        content: file.content,
        contentHashDigest: file.contentHashDigest,
        status: "pending",
      })
      .returning({ id: codebaseFile.id });

    const fileId = inserted!.id;

    // Chunk the file
    const chunks = chunkFile(file.content, file.path);

    if (chunks.length === 0) {
      await tx
        .update(codebaseFile)
        .set({ status: "complete", indexedAt: new Date() })
        .where(eq(codebaseFile.id, fileId));
      return;
    }

    // Embed all chunks
    const embeddings = await embedTexts(chunks.map((c) => c.content));

    if (embeddings.length !== chunks.length) {
      throw new Error("Embedding results count doesn't match the chunks count");
    }

    // Insert chunks with embeddings
    const chunkValues = chunks.map((chunk, i) => ({
      ...newBaseFieldsValue(),
      content: chunk.content,
      symbolName: chunk.symbolName,
      symbolKind: chunk.symbolKind,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      embedding: embeddings[i] as number[],
      fileId,
    }));

    await tx.insert(codebaseChunk).values(chunkValues);

    // Collect indexed chunks for graph edge resolution
    result.chunks = chunkValues.map((v) => ({
      id: v.id,
      symbolName: v.symbolName,
    }));

    // Extract raw references for graph edges
    result.rawRefs = extractReferences(file.content, file.path, chunks);

    // Mark file as complete
    await tx
      .update(codebaseFile)
      .set({ status: "complete", indexedAt: new Date() })
      .where(eq(codebaseFile.id, fileId));
  });

  return result;
}

async function resolveGraphEdges(allResults: FileIndexResult[]): Promise<void> {
  // Build symbol name → chunk IDs lookup from all indexed files
  const symbolToChunkIds = new Map<string, string[]>();
  const chunkSymbolNameToId = new Map<string, string>();

  for (const result of allResults) {
    for (const chunk of result.chunks) {
      const ids = symbolToChunkIds.get(chunk.symbolName) ?? [];
      ids.push(chunk.id);
      symbolToChunkIds.set(chunk.symbolName, ids);
      chunkSymbolNameToId.set(chunk.symbolName, chunk.id);
    }
  }

  // Also include existing chunks from DB (for cross-file references to unchanged files)
  const existingChunks = await db
    .select({ id: codebaseChunk.id, symbolName: codebaseChunk.symbolName })
    .from(codebaseChunk);

  for (const chunk of existingChunks) {
    if (!chunkSymbolNameToId.has(chunk.symbolName)) {
      const ids = symbolToChunkIds.get(chunk.symbolName) ?? [];
      ids.push(chunk.id);
      symbolToChunkIds.set(chunk.symbolName, ids);
    }
  }

  // Resolve raw references to edges
  const edges: { fromId: string; toId: string }[] = [];

  for (const result of allResults) {
    for (const ref of result.rawRefs) {
      const fromId = chunkSymbolNameToId.get(ref.chunkSymbolName);
      if (!fromId) continue;

      for (const identifier of ref.referencedIdentifiers) {
        const targetIds = symbolToChunkIds.get(identifier);
        if (!targetIds) continue;

        for (const toId of targetIds) {
          if (fromId !== toId) {
            edges.push({ fromId, toId });
          }
        }
      }
    }
  }

  if (edges.length === 0) return;

  // Batch-insert edges
  await db.insert(graphEdge).values(
    edges.map((edge) => ({
      ...newBaseFieldsValue(),
      relationship: "references" as const,
      fromId: edge.fromId,
      toId: edge.toId,
    })),
  );

  console.log(`Created ${edges.length} graph edges`);
}

async function startIndexing(opts: IndexingOpts): Promise<void> {
  const files = await loadFiles({
    includePatterns: opts.include,
    excludePatterns: opts.exclude,
  });

  console.log(`Found ${files.length} files`);

  const diskFiles: DiskFile[] = files.map((f) => ({
    path: f.path,
    content: f.content,
    contentHashDigest: hash(f.content),
  }));

  const allResults: FileIndexResult[] = [];

  if (opts.force) {
    console.log("Force mode: full re-index");

    // Delete all files (CASCADE cleans chunks and edges)
    await db.delete(codebaseFile);

    for (const file of diskFiles) {
      allResults.push(await indexFile(file));
    }

    await resolveGraphEdges(allResults);
    console.log(`Indexed ${diskFiles.length} files (force)`);
    return;
  }

  // Clean up pending files from interrupted runs (CASCADE cleans chunks)
  const pendingDeleted = await db
    .delete(codebaseFile)
    .where(eq(codebaseFile.status, "pending"))
    .returning({ filePath: codebaseFile.filePath });

  if (pendingDeleted.length > 0) {
    console.log(`Cleaned up ${pendingDeleted.length} pending entries`);
  }

  // Load DB state and diff
  const dbFiles = await db
    .select({
      filePath: codebaseFile.filePath,
      contentDigest: codebaseFile.contentHashDigest,
    })
    .from(codebaseFile)
    .where(eq(codebaseFile.status, "complete"));

  const diff = diffFiles(
    diskFiles.map((f) => ({
      path: f.path,
      contentHashDigest: f.contentHashDigest,
    })),
    dbFiles,
  );

  // Delete removed files (CASCADE cleans chunks and edges)
  for (const filePath of diff.deleted) {
    await db.delete(codebaseFile).where(eq(codebaseFile.filePath, filePath));
  }

  // Index added and modified files
  const fileMap = new Map(diskFiles.map((f) => [f.path, f]));

  for (const filePath of diff.added) {
    allResults.push(await indexFile(fileMap.get(filePath)!));
  }

  // Re-index modified files (delete + insert atomically in one transaction)
  for (const filePath of diff.modified) {
    allResults.push(
      await indexFile(fileMap.get(filePath)!, { deleteExisting: true }),
    );
  }

  // Delete stale edges for re-indexed chunks and resolve new edges
  if (allResults.length > 0) {
    const reindexedChunkIds = allResults.flatMap((r) =>
      r.chunks.map((c) => c.id),
    );
    if (reindexedChunkIds.length > 0) {
      await db
        .delete(graphEdge)
        .where(inArray(graphEdge.fromId, reindexedChunkIds));
    }
    await resolveGraphEdges(allResults);
  }

  console.log(
    `Indexed ${diff.added.length} new, ${diff.modified.length} updated, ` +
      `${diff.deleted.length} deleted, ${diff.unchanged.length} unchanged`,
  );
}

export { startIndexing, diffFiles };
