#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import z from "zod";
import { memoryManager } from "@/memory/manager";
import { codebaseMemory } from "@/memory/codebase";
import { runIndex } from "@/indexing/run-index";
import { client } from "@/lib/client";

const VALID_KINDS = ["codebase", "docs", "conversation", "knowledge"] as const;
type Kind = (typeof VALID_KINDS)[number];

const memories = {
  codebase: codebaseMemory,
} as const;

// oxlint-disable-next-line typescript/no-floating-promises
yargs(hideBin(process.argv))
  .command(
    "recall <queries...>",
    "Queries the memory",
    (yargs) => {
      return yargs
        .positional("queries", {
          describe: "A list of queries to read memory",
          default: [],
        })
        .option("kind", {
          alias: "k",
          describe: "The memory kind to query",
          choices: VALID_KINDS,
          default: "codebase" as Kind,
        });
    },
    async (argv) => {
      const { queries: maybeQueries, kind } = argv;
      const queries = z.string().array().parse(maybeQueries);
      const result = await memoryManager.read({ kind, queries } as any);
      console.log(JSON.stringify(result, null, 4));
      await close();
    },
  )
  .command(
    "index",
    "Indexes source files into memory",
    (yargs) => {
      return yargs
        .option("kind", {
          alias: "k",
          describe: "The memory kind to index",
          choices: VALID_KINDS,
          default: "codebase" as Kind,
        })
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
      const { kind } = argv;
      const memory = memories[kind as keyof typeof memories];

      if (!memory) {
        console.error(`Indexing for kind "${kind}" is not yet implemented`);
        process.exit(1);
      }

      await runIndex({
        kind,
        includePatterns: argv.include,
        excludePatterns: argv.exclude,
        force: argv.force,
        memory,
      });

      await client.shutdown();
    },
  )
  .demandCommand(1, "Please specify a command: recall or index")
  .parse();
