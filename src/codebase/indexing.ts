import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { codebaseChunk, codebaseFile } from "@/db/schema";
import { chunkFile } from "@/codebase/chunker/router";
import { embedTexts } from "@/codebase/embed";
import { buildFileGraph } from "@/codebase/graph/graph";
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
  projectRoot: string;
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

async function indexFile(file: DiskFile, opts?: { deleteExisting?: boolean }) {
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
    await tx.insert(codebaseChunk).values(
      chunks.map((chunk, i) => ({
        ...newBaseFieldsValue(),
        content: chunk.content,
        symbolName: chunk.symbolName,
        symbolKind: chunk.symbolKind,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        embedding: embeddings[i] as number[],
        fileId,
      })),
    );

    // Mark file as complete
    await tx
      .update(codebaseFile)
      .set({ status: "complete", indexedAt: new Date() })
      .where(eq(codebaseFile.id, fileId));
  });
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

    // Delete all files (CASCADE cleans chunks)
    await db.delete(codebaseFile);

    for (const file of diskFiles) {
      await indexFile(file);
    }

    console.log(`Indexed ${diskFiles.length} files (force)`);
  } else {
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

    // Delete removed files (CASCADE cleans chunks)
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

    console.log(
      `Indexed ${diff.added.length} new, ${diff.modified.length} updated, ` +
        `${diff.deleted.length} deleted, ${diff.unchanged.length} unchanged`,
    );
  }

  // Build file dependency graph
  const graph = await buildFileGraph(opts.projectRoot);
  console.log(
    `Graph: ${graph.edgesCreated} edges from ${graph.filesProcessed} files`,
  );
}

export { startIndexing, diffFiles };
