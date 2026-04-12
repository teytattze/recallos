import { drizzle } from "drizzle-orm/bun-sql";
import {
  codebaseChunkTable,
  codebaseFileGraphEdgeTable,
  codebaseFileTable,
  codebaseTable,
  relations,
} from "./schema";
import { SQL } from "bun";

const client = new SQL(process.env.DATABASE_URL!);

const db = drizzle({
  client,
  schema: {
    codebaseChunkTable,
    codebaseFileGraphEdgeTable,
    codebaseFileTable,
    codebaseTable,
    relations,
  },
});

export { db };
