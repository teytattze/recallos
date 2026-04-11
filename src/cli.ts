#!/usr/bin/env bun
import readline from "node:readline/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import z from "zod";
import { searchCodebase } from "@/codebase/query";
import { startIndexing } from "@/codebase/indexing";
import {
  ensureCodebase,
  listCodebases,
  deleteCodebase,
} from "@/codebase/codebase";
import { loadConfig, saveConfig } from "@/lib/config";
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
      const config = await loadConfig();
      const result = await searchCodebase(queries, config.codebase.id);
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
      const config = await loadConfig();
      await startIndexing({
        include: argv.include,
        exclude: [...argv.exclude, ...config.excludePattern],
        force: argv.force,
        projectRoot: process.cwd(),
        codebaseId: config.codebase.id,
      });
    },
  )
  .command(
    "setup",
    "Set up RecallOS for this project",
    () => {},
    async () => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const name = await rl.question("Codebase name: ");

      if (!name.trim()) {
        console.error("Codebase name cannot be empty");
        process.exit(1);
      }

      const cb = await ensureCodebase(name.trim());
      await saveConfig({ codebase: { id: cb.id }, excludePattern: [] });
      console.log(`Codebase "${cb.name}" (${cb.id}) saved to .recallos.json`);

      rl.close();
    },
  )
  .command("codebase", "Manage codebases", (yargs) => {
    return yargs
      .command(
        "list",
        "List all codebases",
        () => {},
        async () => {
          const codebases = await listCodebases();
          if (codebases.length === 0) {
            console.log("No codebases found");
            return;
          }
          for (const cb of codebases) {
            console.log(`${cb.name}\t${cb.id}`);
          }
        },
      )
      .command(
        "delete <name>",
        "Delete a codebase and all its data",
        (yargs) => {
          return yargs.positional("name", {
            describe: "Codebase name to delete",
            type: "string",
            demandOption: true,
          });
        },
        async (argv) => {
          const deleted = await deleteCodebase(argv.name!);
          if (deleted) {
            console.log(`Deleted codebase: ${argv.name}`);
          } else {
            console.error(`Codebase not found: ${argv.name}`);
            process.exit(1);
          }
        },
      )
      .demandCommand(1, "Please specify a subcommand: list or delete");
  })
  .demandCommand(
    1,
    "Please specify a command: setup, search, index, or codebase",
  )
  .parse();
