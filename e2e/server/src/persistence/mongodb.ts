import { MongoClient, type Document, type IndexDescription } from "mongodb";

type CreateMongodbClientInput = {
  url: string;
};

type InitMongodbInput = {
  client: MongoClient;
  databaseDefs: [
    {
      name: string;
      collectionDefs: {
        name: string;
        indexes: IndexDescription[];
      }[];
    },
  ];
};

type SeedMongodbInput = {
  client: MongoClient;
  databaseName: string;
  collectionName: string;
  docs: Document[];
};

type ResetMongodbInput = {
  client: MongoClient;
  databaseName: string;
  collectionName: string;
};

const createMongodbClient = (input: CreateMongodbClientInput) => {
  return new MongoClient(input.url);
};

const initMongodb = async (input: InitMongodbInput) => {
  const { client, databaseDefs } = input;
  for (const databaseDef of databaseDefs) {
    const database = client.db(databaseDef.name);
    for (const collectionDef of databaseDef.collectionDefs) {
      const collection = database.collection(collectionDef.name);
      await collection.createIndexes(collectionDef.indexes);
    }
  }
};

const seedMongodbCollection = async (input: SeedMongodbInput) => {
  const { client, collectionName, databaseName, docs } = input;
  const collection = client.db(databaseName).collection(collectionName);
  await collection.insertMany(docs);
};

const resetMongodbCollection = async (input: ResetMongodbInput) => {
  const { client, collectionName, databaseName } = input;
  const collection = client.db(databaseName).collection(collectionName);
  await collection.deleteMany({ _id: { $exists: true } });
};

export {
  createMongodbClient,
  initMongodb,
  seedMongodbCollection,
  resetMongodbCollection,
};
