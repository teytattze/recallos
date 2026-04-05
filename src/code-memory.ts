import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { client } from "./client";

const COLLECTION_NAME = "code_collection";
const EMBEDDING_MODEL = "voyage-code-3.5";

type Metadata = {
  filePath: string;
};

const getCollection = async () =>
  await client.chromadb.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: null,
  });

const read = async (input: { queries: string[] }) => {
  const { queries } = input;

  const embeddings = await client.voyageai.embed({
    input: queries,
    model: EMBEDDING_MODEL,
  });

  const codeCollection = await getCollection();

  return await codeCollection.query<Metadata>({
    queryEmbeddings: embeddings.data?.map((item) => item.embedding ?? []),
    nResults: 3,
  });
};

const write = async (input: { code: string; filePath: string }) => {
  const { code, filePath } = input;

  const jsSplitter = RecursiveCharacterTextSplitter.fromLanguage("js", {
    chunkSize: 120,
    chunkOverlap: 0,
  });
  const docs = await jsSplitter.createDocuments([code], [{ filePath }]);

  const embeddings = await client.voyageai.embed({
    input: docs.map((doc) => doc.pageContent),
    model: EMBEDDING_MODEL,
  });

  const chunks = docs.map((doc, i) => ({
    id: filePath + "#" + i,
    document: doc.pageContent,
    embedding: embeddings.data?.[i]?.embedding ?? [],
    metadata: {
      filePath: doc.metadata["filePath"],
    },
  }));

  const codeCollection = await getCollection();

  await codeCollection.add({
    ids: chunks.map((chunk) => chunk.id),
    documents: chunks.map((chunk) => chunk.document),
    embeddings: chunks.map((chunk) => chunk.embedding),
    metadatas: chunks.map((chunk) => chunk.metadata),
  });
};

const codeMemory = {
  read,
  write,
};

export { codeMemory };
