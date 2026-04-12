import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
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

const codebaseTable = pgTable("codebases", {
  ...makeBaseFields(),
  name: text("name").notNull().unique(),
});
type SelectCodebase = typeof codebaseTable.$inferSelect;

const codebaseFileTable = pgTable(
  "codebase_files",
  {
    ...makeBaseFields(),

    filePath: text("file_path").notNull(),
    content: text("content").notNull(),
    contentHashDigest: text("content_hash_digest").notNull(),
    status: text("status").notNull().default("pending"),
    indexedAt: timestamp("indexed_at"),

    codebaseId: uuid("codebase_id")
      .notNull()
      .references(() => codebaseTable.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.codebaseId, t.filePath)],
);

const codebaseChunkTable = pgTable("codebase_chunks", {
  ...makeBaseFields(),

  content: text("content").notNull(),
  symbolName: text("symbol_name").notNull(),
  symbolKind: text("symbol_kind").notNull(),
  startLine: integer("start_line").notNull(),
  endLine: integer("end_line").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }).notNull(),

  fileId: uuid("file_id")
    .notNull()
    .references(() => codebaseFileTable.id, { onDelete: "cascade" }),
});

const codebaseFileGraphEdgeTable = pgTable("codebase_file_graph_edges", {
  ...makeBaseFields(),

  relationship: text("relationship", { enum: ["references"] }).notNull(),

  fromId: uuid("from_id")
    .notNull()
    .references(() => codebaseFileTable.id, { onDelete: "cascade" }),
  toId: uuid("to_id")
    .notNull()
    .references(() => codebaseFileTable.id, { onDelete: "cascade" }),
});

const relations = defineRelations(
  {
    codebase: codebaseTable,
    codebaseChunk: codebaseChunkTable,
    codebaseFile: codebaseFileTable,
    codebaseFileGraphEdge: codebaseFileGraphEdgeTable,
  },
  (r) => ({
    codebase: {
      files: r.many.codebaseFile({
        from: r.codebase.id,
        to: r.codebaseFile.codebaseId,
      }),
    },

    codebaseChunk: {
      file: r.one.codebaseFile({
        from: r.codebaseChunk.fileId,
        to: r.codebaseFile.id,
      }),
    },

    codebaseFile: {
      codebase: r.one.codebase({
        from: r.codebaseFile.codebaseId,
        to: r.codebase.id,
      }),
      chunks: r.many.codebaseChunk({
        from: r.codebaseFile.id,
        to: r.codebaseChunk.fileId,
      }),
      outgoingEdges: r.many.codebaseFileGraphEdge({
        from: r.codebaseFile.id,
        to: r.codebaseFileGraphEdge.fromId,
        alias: "from",
      }),
      incomingEdges: r.many.codebaseFileGraphEdge({
        from: r.codebaseFile.id,
        to: r.codebaseFileGraphEdge.toId,
        alias: "to",
      }),
    },

    codebaseFileGraphEdge: {
      from: r.one.codebaseFile({
        from: r.codebaseFileGraphEdge.fromId,
        to: r.codebaseFile.id,
        alias: "from",
      }),
      to: r.one.codebaseFile({
        from: r.codebaseFileGraphEdge.toId,
        to: r.codebaseFile.id,
        alias: "to",
      }),
    },
  }),
);

export {
  codebaseTable,
  codebaseChunkTable,
  codebaseFileTable,
  codebaseFileGraphEdgeTable,
  relations,
};
export type { BaseFields, SelectCodebase };
