import z from "zod";
import { client } from "@/lib/client";
import { typescriptChunker } from "@/memory/chunker/typescript";
import type { MemoryAdapter } from "@/memory/types";

const COLLECTION_NAME = "codebase_collection";
const EMBEDDING_MODEL = "voyage-code-3.5";

type Metadata = {
  filePath: string;
  symbolName: string;
  symbolKind: string;
  startLine: number;
  endLine: number;
};

async function getCollection() {
  return await client.chromadb.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: null,
  });
}

// -- Schemas --

const readInputSchema = z.object({
  kind: z.literal("codebase").describe("The memory kind to read from"),
  queries: z
    .string()
    .array()
    .describe(
      "Natural-language search queries describing what you're looking for (e.g. 'how authentication works', 'database query helpers', 'API route handlers'). Use multiple queries to cover different angles of the same question.",
    ),
});

const readOutputSchema = z.object({
  kind: z.literal("codebase").describe("The memory kind that was read from"),
  queryOutputs: z
    .object({
      originalQuery: z
        .string()
        .describe("The original search query that produced these results"),
      results: z
        .object({
          id: z.string().describe("The unique ID of the code"),
          document: z
            .string()
            .describe("The actual document (content) of the search result"),
          filePath: z
            .string()
            .describe(
              "The relative file path location of the actual document (content)",
            ),
          symbolName: z
            .string()
            .describe("The name of the symbol (function, class, type, etc.)"),
          symbolKind: z
            .string()
            .describe(
              "The kind of symbol: function, class, interface, type, enum, variable, preamble, or file",
            ),
          startLine: z
            .number()
            .describe(
              "The starting line number of the symbol in the source file",
            ),
          endLine: z
            .number()
            .describe(
              "The ending line number of the symbol in the source file",
            ),
        })
        .array()
        .describe("The list of matching code results for this query"),
    })
    .array()
    .describe("The results grouped by each input query"),
});

const writeInputSchema = z.object({
  kind: z.literal("codebase").describe("The memory kind to write to"),
  items: z
    .object({
      code: z.string().describe("The source code content to store in memory"),
      filePath: z
        .string()
        .describe("The relative file path of the source code"),
    })
    .array()
    .describe("The list of code items to write to memory"),
});

const writeOutputSchema = z.object({
  kind: z.literal("codebase").describe("The memory kind that was written to"),
});

// -- Handlers --

type ReadInput = z.infer<typeof readInputSchema>;
type ReadOutput = z.infer<typeof readOutputSchema>;
type WriteInput = z.infer<typeof writeInputSchema>;
type WriteOutput = z.infer<typeof writeOutputSchema>;

async function read(input: ReadInput): Promise<ReadOutput> {
  const { queries } = input;

  const embeddings = await client.voyageai.embed({
    input: queries,
    model: EMBEDDING_MODEL,
  });

  const codeCollection = await getCollection();

  const result = await codeCollection.query<Metadata>({
    queryEmbeddings: embeddings.data?.map((item) => item.embedding ?? []),
    nResults: 10,
  });

  return {
    kind: "codebase",
    queryOutputs: queries.map((query, queryIndex) => ({
      originalQuery: query,
      results:
        result.ids[queryIndex]?.map((id, i) => ({
          id,
          document: result.documents[queryIndex]?.[i] ?? "",
          filePath: String(result.metadatas[queryIndex]?.[i]?.filePath ?? ""),
          symbolName: String(
            result.metadatas[queryIndex]?.[i]?.symbolName ?? "",
          ),
          symbolKind: String(
            result.metadatas[queryIndex]?.[i]?.symbolKind ?? "",
          ),
          startLine: Number(result.metadatas[queryIndex]?.[i]?.startLine ?? 0),
          endLine: Number(result.metadatas[queryIndex]?.[i]?.endLine ?? 0),
        })) ?? [],
    })),
  };
}

async function write(input: WriteInput): Promise<WriteOutput> {
  await Promise.all(
    input.items.map((item) =>
      writeOne({ code: item.code, filePath: item.filePath }),
    ),
  );
  return { kind: "codebase" };
}

async function writeOne(input: {
  code: string;
  filePath: string;
}): Promise<string[]> {
  const { code, filePath } = input;

  const codeChunks = await typescriptChunker.chunkCode(code, filePath);

  const embeddings = await client.voyageai.embed({
    input: codeChunks.map((chunk) => chunk.content),
    model: EMBEDDING_MODEL,
  });

  const records = codeChunks.map((chunk, i) => ({
    id: Bun.randomUUIDv7(),
    document: chunk.content,
    embedding: embeddings.data?.[i]?.embedding ?? [],
    metadata: {
      filePath: chunk.filePath,
      symbolName: chunk.symbolName,
      symbolKind: chunk.symbolKind,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
    },
  }));

  const codeCollection = await getCollection();

  await codeCollection.add({
    ids: records.map((r) => r.id),
    documents: records.map((r) => r.document),
    embeddings: records.map((r) => r.embedding),
    metadatas: records.map((r) => r.metadata),
  });

  return records.map((r) => r.id);
}

async function deleteChunks(ids: string[]) {
  if (ids.length === 0) return;
  const codeCollection = await getCollection();
  await codeCollection.delete({ ids });
}

const codebaseMemory = {
  name: "codebase" as const,
  readInputSchema,
  readOutputSchema,
  writeInputSchema,
  writeOutputSchema,
  read,
  write,
  writeOne,
  deleteChunks,
} satisfies MemoryAdapter<ReadInput, ReadOutput, WriteInput, WriteOutput> & {
  writeOne: typeof writeOne;
};

export { codebaseMemory, COLLECTION_NAME };
