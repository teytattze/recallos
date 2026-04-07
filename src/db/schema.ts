import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { defineRelations } from "drizzle-orm";

const makeId = (name: string) => uuid(name);

const makeBaseFields = () => ({
  id: makeId("id").primaryKey(),
});
type BaseFields = {
  id: string;
};

const codebaseFile = pgTable("codebase_files", {
  ...makeBaseFields(),

  filePath: text("file_path").notNull().unique(),
  content: text("content").notNull(),
  contentHashDigest: text("content_hash_digest").notNull(),
  status: text("status").notNull().default("pending"),
  indexedAt: timestamp("indexed_at"),
});

const codebaseChunk = pgTable("codebase_chunks", {
  ...makeBaseFields(),

  content: text("content").notNull(),
  symbolName: text("symbol_name").notNull(),
  symbolKind: text("symbol_kind").notNull(),
  startLine: integer("start_line").notNull(),
  endLine: integer("end_line").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }),

  fileId: uuid("file_id")
    .notNull()
    .references(() => codebaseFile.id, { onDelete: "cascade" }),
});

const graphEdge = pgTable("graph_edges", {
  ...makeBaseFields(),

  relationship: text("relationship").notNull(),

  fromId: uuid("from_id").notNull(),
  fromKind: text("from_kind").notNull(),
  toId: uuid("to_id").notNull(),
  toKind: text("to_kind").notNull(),
});

const relations = defineRelations(
  { codebaseChunk, codebaseFile, graphEdge },
  (r) => ({
    codebaseChunk: {
      file: r.one.codebaseFile({
        from: r.codebaseChunk.fileId,
        to: r.codebaseFile.id,
      }),
    },

    codebaseFile: {
      codebaseChunk: r.many.codebaseChunk(),
    },
  }),
);

export { codebaseChunk, codebaseFile, graphEdge, relations };
export type { BaseFields };
