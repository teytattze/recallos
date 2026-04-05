import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import z from "zod";
import { memoryManager } from "./memory-manager";

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
  .parse();
