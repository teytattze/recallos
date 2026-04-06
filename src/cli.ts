#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import z from "zod";
import { memoryManager } from "./memory-manager";
import { client } from "./client";
import { codeMemory } from "./code-memory";
import { indexState } from "./index-state";
import { diffFiles } from "./incremental-index";
import { util } from "./util";

yargs(hideBin(process.argv))
  .command(
    "recall <queries...>",
    "Queries the memory",
    (yargs) => {
      return yargs.positional("queries", {
        describe: "A list of queries to read memory",
        default: [],
      });
    },
    async (argv) => {
      const { queries: maybeQueries } = argv;
      const queries = z.string().array().parse(maybeQueries);
      const result = await memoryManager.read({ kind: "code", queries });
      console.log(JSON.stringify(result, null, 4));
    },
  )
  .command(
    "index",
    "Indexes source files into memory",
    (yargs) => {
      return yargs
        .option("include", {
          alias: "i",
          describe: "Glob patterns to include",
          type: "string",
          array: true,
          default: ["src/**/*.ts"],
        })
        .option("exclude", {
          alias: "e",
          describe: "Glob patterns to exclude",
          type: "string",
          array: true,
          default: ["node_modules/**"],
        })
        .option("force", {
          alias: "f",
          describe: "Force full re-index, ignoring cached state",
          type: "boolean",
          default: false,
        });
    },
    async (argv) => {
      const files = await util.loadFiles({
        includePatterns: argv.include,
        excludePatterns: argv.exclude,
      });

      console.log(`Found ${files.length} files`);

      await indexState.ensureIndexes();

      const diskFiles = files.map((f) => ({
        path: f.path,
        content: f.content,
        hash: util.hashContent(f.content),
      }));

      if (argv.force) {
        console.log("Force mode: full re-index");
        try {
          await client.chromadb.deleteCollection({ name: "code_collection" });
        } catch {
          // Collection may not exist yet
        }
        await indexState.deleteAll();

        for (const file of diskFiles) {
          await indexState.insertPending(file.path, file.hash);
          const chunkIds = await codeMemory.write({
            code: file.content,
            filePath: file.path,
          });
          await indexState.markComplete(file.path, chunkIds);
        }

        console.log(`Indexed ${diskFiles.length} files (force)`);
        return;
      }

      // Clean up pending docs from interrupted previous runs
      const pendingDocs = await indexState.getPending();
      if (pendingDocs.length > 0) {
        const pendingChunkIds = pendingDocs.flatMap((d) => d.chunkIds);
        await codeMemory.deleteChunks(pendingChunkIds);
        await indexState.deleteMany(pendingDocs.map((d) => d.filePath));
        console.log(`Cleaned up ${pendingDocs.length} pending entries`);
      }

      // Fetch complete state and diff
      const stateEntries = await indexState.getAll();
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
        await codeMemory.deleteChunks(deletedChunkIds);
        await indexState.deleteMany(diff.deleted);
      }

      // Handle MODIFIED files (delete old chunks)
      if (diff.modified.length > 0) {
        const modifiedState = stateEntries.filter((s) =>
          diff.modified.includes(s.filePath),
        );
        const modifiedChunkIds = modifiedState.flatMap((s) => s.chunkIds);
        await codeMemory.deleteChunks(modifiedChunkIds);
        await indexState.deleteMany(diff.modified);
      }

      // Index ADDED + MODIFIED files (two-phase write)
      const toIndex = [...diff.added, ...diff.modified];
      const fileMap = new Map(diskFiles.map((f) => [f.path, f]));

      for (const filePath of toIndex) {
        const file = fileMap.get(filePath)!;
        await indexState.insertPending(file.path, file.hash);
        const chunkIds = await codeMemory.write({
          code: file.content,
          filePath: file.path,
        });
        await indexState.markComplete(file.path, chunkIds);
      }

      console.log(
        `Indexed ${diff.added.length} new, ${diff.modified.length} updated, ` +
          `${diff.deleted.length} deleted, ${diff.unchanged.length} unchanged`,
      );
    },
  )
  .demandCommand(1, "Please specify a command: recall or index")
  .parse();
