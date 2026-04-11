#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import z from "zod";
import { searchCodebase } from "@/codebase/query";
import { startIndexing } from "@/codebase/indexing";
import { loadGitignorePatterns } from "@/lib/util";

// oxlint-disable-next-line typescript/no-floating-promises
yargs(hideBin(process.argv))
  .command(
    "search <queries...>",
    "Search the codebase",
    (yargs) => {
      return yargs.positional("queries", {
        describe: "A list of queries to search the codebase",
        default: [],
      });
    },
    async (argv) => {
      const queries = z.string().array().parse(argv.queries);
      const result = await searchCodebase(queries);
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
          default: ["**/*.{ts,md,json}"],
        })
        .option("exclude", {
          alias: "e",
          describe: "Glob patterns to exclude",
          type: "string",
          array: true,
          default: [...loadGitignorePatterns()],
        })
        .option("force", {
          alias: "f",
          describe: "Force full re-index, ignoring cached state",
          type: "boolean",
          default: false,
        });
    },
    async (argv) => {
      await startIndexing({
        include: argv.include,
        exclude: argv.exclude,
        force: argv.force,
        projectRoot: process.cwd(),
      });
    },
  )
  .demandCommand(1, "Please specify a command: recall or index")
  .parse();
