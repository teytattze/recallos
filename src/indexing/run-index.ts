import { indexState } from "@/indexing/index-state";
import { diffFiles } from "@/indexing/incremental-index";
import { client } from "@/lib/client";
import { util } from "@/lib/util";
import { COLLECTION_NAME } from "@/memory/codebase";

type MemoryWriter = {
  writeOne(input: { code: string; filePath: string }): Promise<string[]>;
  deleteChunks(ids: string[]): Promise<void>;
};

type RunIndexInput = {
  kind: string;
  includePatterns: string[];
  excludePatterns: string[];
  force: boolean;
  memory: MemoryWriter;
};

type RunIndexResult = {
  added: number;
  modified: number;
  deleted: number;
  unchanged: number;
};

async function runIndex(input: RunIndexInput): Promise<RunIndexResult> {
  const { kind, force, memory } = input;

  const files = await util.loadFiles({
    includePatterns: input.includePatterns,
    excludePatterns: input.excludePatterns,
  });

  console.log(`Found ${files.length} files`);

  await indexState.ensureIndexes();

  const diskFiles = files.map((f) => ({
    path: f.path,
    content: f.content,
    hash: util.hashContent(f.content),
  }));

  if (force) {
    console.log("Force mode: full re-index");
    try {
      await client.chromadb.deleteCollection({ name: COLLECTION_NAME });
    } catch {
      // Collection may not exist yet
    }
    await indexState.deleteAll(kind);

    for (const file of diskFiles) {
      await indexState.insertPending(kind, file.path, file.hash);
      const chunkIds = await memory.writeOne({
        code: file.content,
        filePath: file.path,
      });
      await indexState.markComplete(kind, file.path, chunkIds);
    }

    console.log(`Indexed ${diskFiles.length} files (force)`);
    return { added: diskFiles.length, modified: 0, deleted: 0, unchanged: 0 };
  }

  // Clean up pending docs from interrupted previous runs
  const pendingDocs = await indexState.getPending(kind);
  if (pendingDocs.length > 0) {
    const pendingChunkIds = pendingDocs.flatMap((d) => d.chunkIds);
    await memory.deleteChunks(pendingChunkIds);
    await indexState.deleteMany(
      kind,
      pendingDocs.map((d) => d.filePath),
    );
    console.log(`Cleaned up ${pendingDocs.length} pending entries`);
  }

  // Fetch complete state and diff
  const stateEntries = await indexState.getAll(kind);
  const diff = diffFiles(
    diskFiles.map((f) => ({ path: f.path, hash: f.hash })),
    stateEntries.map((s) => ({
      filePath: s.filePath,
      contentHash: s.contentHash,
    })),
  );

  // Handle DELETED files
  if (diff.deleted.length > 0) {
    const deletedState = stateEntries.filter((s) =>
      diff.deleted.includes(s.filePath),
    );
    const deletedChunkIds = deletedState.flatMap((s) => s.chunkIds);
    await memory.deleteChunks(deletedChunkIds);
    await indexState.deleteMany(kind, diff.deleted);
  }

  // Handle MODIFIED files (delete old chunks)
  if (diff.modified.length > 0) {
    const modifiedState = stateEntries.filter((s) =>
      diff.modified.includes(s.filePath),
    );
    const modifiedChunkIds = modifiedState.flatMap((s) => s.chunkIds);
    await memory.deleteChunks(modifiedChunkIds);
    await indexState.deleteMany(kind, diff.modified);
  }

  // Index ADDED + MODIFIED files (two-phase write)
  const toIndex = [...diff.added, ...diff.modified];
  const fileMap = new Map(diskFiles.map((f) => [f.path, f]));

  for (const filePath of toIndex) {
    const file = fileMap.get(filePath)!;
    await indexState.insertPending(kind, file.path, file.hash);
    const chunkIds = await memory.writeOne({
      code: file.content,
      filePath: file.path,
    });
    await indexState.markComplete(kind, file.path, chunkIds);
  }

  console.log(
    `Indexed ${diff.added.length} new, ${diff.modified.length} updated, ` +
      `${diff.deleted.length} deleted, ${diff.unchanged.length} unchanged`,
  );

  return {
    added: diff.added.length,
    modified: diff.modified.length,
    deleted: diff.deleted.length,
    unchanged: diff.unchanged.length,
  };
}

export { runIndex };
export type { MemoryWriter, RunIndexInput, RunIndexResult };
