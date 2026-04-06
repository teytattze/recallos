import { client } from "./client";

const DB_NAME = "recallos";
const COLLECTION_NAME = "index_state";

type IndexStateDoc = {
  kind: string;
  filePath: string;
  contentHash: string;
  chunkIds: string[];
  status: "pending" | "complete";
  indexedAt: Date | null;
};

function getCollection() {
  return client.mongodb.db(DB_NAME).collection<IndexStateDoc>(COLLECTION_NAME);
}

async function ensureIndexes() {
  const col = getCollection();
  await col.createIndex({ kind: 1, filePath: 1 }, { unique: true });
}

async function insertPending(kind: string, filePath: string, contentHash: string) {
  const col = getCollection();
  await col.updateOne(
    { kind, filePath },
    {
      $set: {
        kind,
        filePath,
        contentHash,
        chunkIds: [],
        status: "pending" as const,
        indexedAt: null,
      },
    },
    { upsert: true },
  );
}

async function markComplete(kind: string, filePath: string, chunkIds: string[]) {
  const col = getCollection();
  await col.updateOne(
    { kind, filePath },
    { $set: { chunkIds, status: "complete" as const, indexedAt: new Date() } },
  );
}

async function getAll(kind: string): Promise<IndexStateDoc[]> {
  const col = getCollection();
  return col.find({ kind, status: "complete" }).toArray() as Promise<IndexStateDoc[]>;
}

async function getPending(kind: string): Promise<IndexStateDoc[]> {
  const col = getCollection();
  return col.find({ kind, status: "pending" }).toArray() as Promise<IndexStateDoc[]>;
}

async function deleteMany(kind: string, filePaths: string[]) {
  if (filePaths.length === 0) return;
  const col = getCollection();
  await col.deleteMany({ kind, filePath: { $in: filePaths } });
}

async function deleteAll(kind: string) {
  const col = getCollection();
  await col.deleteMany({ kind });
}

const indexState = {
  ensureIndexes,
  insertPending,
  markComplete,
  getAll,
  getPending,
  deleteMany,
  deleteAll,
};

export { indexState, type IndexStateDoc };
