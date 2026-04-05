import { client } from "./client";
import { chunker } from "./chunker";

const COLLECTION_NAME = "code_collection";
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

async function read(input: { queries: string[] }) {
  const { queries } = input;

  const embeddings = await client.voyageai.embed({
    input: queries,
    model: EMBEDDING_MODEL,
  });

  const codeCollection = await getCollection();

  return await codeCollection.query<Metadata>({
    queryEmbeddings: embeddings.data?.map((item) => item.embedding ?? []),
    nResults: 10,
  });
}

async function write(input: { code: string; filePath: string }) {
  const { code, filePath } = input;

  const codeChunks = chunker.chunkCode(code, filePath);

  const embeddings = await client.voyageai.embed({
    input: codeChunks.map((chunk) => chunk.content),
    model: EMBEDDING_MODEL,
  });

  const records = codeChunks.map((chunk, i) => ({
    id: `${filePath}#${chunk.symbolName}`,
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
}

const codeMemory = {
  read,
  write,
};

export { codeMemory };
