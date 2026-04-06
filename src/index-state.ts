import { client } from "./client";

const DB_NAME = "recallos";
const COLLECTION_NAME = "index_state";

type IndexStateDoc = {
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
  await col.createIndex({ filePath: 1 }, { unique: true });
}

async function insertPending(filePath: string, contentHash: string) {
  const col = getCollection();
  await col.updateOne(
    { filePath },
    {
      $set: {
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

async function markComplete(filePath: string, chunkIds: string[]) {
  const col = getCollection();
  await col.updateOne(
    { filePath },
    { $set: { chunkIds, status: "complete" as const, indexedAt: new Date() } },
  );
}

async function getAll(): Promise<IndexStateDoc[]> {
  const col = getCollection();
  return col.find({ status: "complete" }).toArray() as Promise<IndexStateDoc[]>;
}

async function getPending(): Promise<IndexStateDoc[]> {
  const col = getCollection();
  return col.find({ status: "pending" }).toArray() as Promise<IndexStateDoc[]>;
}

async function deleteMany(filePaths: string[]) {
  if (filePaths.length === 0) return;
  const col = getCollection();
  await col.deleteMany({ filePath: { $in: filePaths } });
}

async function deleteAll() {
  const col = getCollection();
  await col.deleteMany({});
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
