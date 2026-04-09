import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { codebaseChunk, codebaseFile, graphEdge } from "@/db/schema";
import type { Chunk } from "@/codebase/chunker/types";
import { chunkFile } from "@/codebase/chunker/router";
import { extractReferences } from "@/codebase/graph/router";
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
): Promise<void> {
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

    // Mark file as complete
    await tx
      .update(codebaseFile)
      .set({ status: "complete", indexedAt: new Date() })
      .where(eq(codebaseFile.id, fileId));
  });
}

async function rebuildAllGraphEdges(): Promise<void> {
  // Load all files and their chunks from DB
  const files = await db
    .select({
      id: codebaseFile.id,
      filePath: codebaseFile.filePath,
      content: codebaseFile.content,
    })
    .from(codebaseFile)
    .where(eq(codebaseFile.status, "complete"));

  const allChunks = await db
    .select({
      id: codebaseChunk.id,
      symbolName: codebaseChunk.symbolName,
      symbolKind: codebaseChunk.symbolKind,
      startLine: codebaseChunk.startLine,
      endLine: codebaseChunk.endLine,
      fileId: codebaseChunk.fileId,
    })
    .from(codebaseChunk);

  const fileIdToPath = new Map(files.map((f) => [f.id, f.filePath]));

  // Build symbol name → chunk IDs lookup
  const symbolToChunkIds = new Map<string, string[]>();
  for (const chunk of allChunks) {
    const ids = symbolToChunkIds.get(chunk.symbolName) ?? [];
    ids.push(chunk.id);
    symbolToChunkIds.set(chunk.symbolName, ids);
  }

  // Group chunks by file for per-file reference extraction
  const chunksByFile = new Map<string, typeof allChunks>();
  for (const chunk of allChunks) {
    const filePath = fileIdToPath.get(chunk.fileId);
    if (!filePath) continue;
    const arr = chunksByFile.get(filePath) ?? [];
    arr.push(chunk);
    chunksByFile.set(filePath, arr);
  }

  // Extract references and resolve edges for each file
  const edges: { fromId: string; toId: string }[] = [];

  for (const file of files) {
    const fileChunks = chunksByFile.get(file.filePath);
    if (!fileChunks || fileChunks.length === 0) continue;

    // Convert DB chunks to the Chunk type expected by extractReferences
    const chunks: Chunk[] = fileChunks.map((c) => ({
      content: "",
      symbolName: c.symbolName,
      symbolKind: c.symbolKind,
      filePath: file.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
    }));

    const rawRefs = extractReferences(file.content, file.filePath, chunks);

    // Build local symbol→id map for this file (chunk names are unique within a file)
    const localSymbolToId = new Map(
      fileChunks.map((c) => [c.symbolName, c.id]),
    );

    for (const ref of rawRefs) {
      const fromId = localSymbolToId.get(ref.chunkSymbolName);
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

  if (opts.force) {
    console.log("Force mode: full re-index");

    // Delete all files (CASCADE cleans chunks and edges)
    await db.delete(codebaseFile);

    for (const file of diskFiles) {
      await indexFile(file);
    }

    await rebuildAllGraphEdges();
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
    await indexFile(fileMap.get(filePath)!);
  }

  // Re-index modified files (delete + insert atomically in one transaction)
  for (const filePath of diff.modified) {
    await indexFile(fileMap.get(filePath)!, { deleteExisting: true });
  }

  // Rebuild all graph edges when any files changed — edges from unchanged files
  // may reference chunks in modified files whose IDs have changed
  const hasChanges =
    diff.added.length > 0 || diff.modified.length > 0 || diff.deleted.length > 0;
  if (hasChanges) {
    await db.delete(graphEdge);
    await rebuildAllGraphEdges();
  }

  console.log(
    `Indexed ${diff.added.length} new, ${diff.modified.length} updated, ` +
      `${diff.deleted.length} deleted, ${diff.unchanged.length} unchanged`,
  );
}

export { startIndexing, diffFiles };
