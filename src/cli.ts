#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import z from "zod";
import { memoryManager } from "./memory-manager";
import { client } from "./client";
import { codeMemory } from "./code-memory";
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
        });
    },
    async (argv) => {
      const files = await util.loadFiles({
        includePatterns: argv.include,
        excludePatterns: argv.exclude,
      });

      console.log(`Found ${files.length} files to index`);

      try {
        await client.chromadb.deleteCollection({ name: "code_collection" });
      } catch {
        // Collection may not exist yet
      }

      await Promise.all(
        files.map((file) =>
          codeMemory.write({ code: file.content, filePath: file.path }),
        ),
      );

      console.log(`Indexed ${files.length} files into code_collection`);
    },
  )
  .demandCommand(1, "Please specify a command: recall or index")
  .parse();
